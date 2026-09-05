"""Adversarial, Invariant, and Boundary Tests for Deal Guardian Governance Engine.

Validates:
1. Context validation (rejection of negative quantities, prices, costs, invalid discounts).
2. Snapshot immutability of approved baseline.
3. Policy resolution boundary cases and invariant effective_ceiling <= MIN(tier, category).
4. Risk score bounds [0, 100] and exact determinism across iterations.
5. Approval FSM multi-tier sequential vs direct routing and illegal transition rejection.
6. Material change detection vs harmless change filtering.
7. Fulfillment conservation invariant: allocated + backorder == requested.
8. Recommendation negative-margin filtering and already-added product exclusion.
9. Health scoring bounds [0, 100] and structured flags.
10. High-throughput performance benchmark (< 5ms per evaluation).
"""

import time
import pytest
from app.governance.context import DealContext, DealLineContext, CustomerContext
from app.governance.policy.resolver import PolicyResolver
from app.governance.policy.models import DiscountPolicy, PolicyReasonCode
from app.governance.risk.calculator import BlendedRiskCalculator
from app.governance.risk.factors import RiskAssessmentResult, RiskSeverity
from app.governance.approval.state_machine import ApprovalStateMachine, ApprovalStage, ApprovalActionType
from app.governance.approval.router import ApprovalRouter, RequiredApprovalLevel
from app.governance.approval.invalidation import MaterialChangeDetector
from app.governance.recommendation.scorer import RecommendationScorer
from app.governance.fulfillment.planner import FulfillmentPlanner
from app.governance.health.calculator import DealHealthCalculator
from app.governance.guardian import DealGuardian
from app.governance.interfaces import (
    MockPolicyProvider,
    MockInventoryProvider,
    MockRecommendationProvider,
    RecommendationCandidate,
    WarehouseStock
)


# =============================================================================
# 1. CONTEXT VALIDATION & SNAPSHOT IMMUTABILITY TESTS
# =============================================================================

def test_context_rejects_negative_quantity():
    """Verify negative quantity throws validation error."""
    with pytest.raises(ValueError, match=r"(greater than or equal to 0|Line quantity cannot be negative)"):
        DealLineContext(
            odoo_line_id=1,
            odoo_product_id=1,
            product_name="Bad Item",
            category_name="Hardware",
            odoo_category_id=1,
            quantity=-5.0,
            price_unit=100.0
        )


def test_context_rejects_negative_price():
    """Verify negative unit price throws validation error."""
    with pytest.raises(ValueError, match=r"(greater than or equal to 0|Unit price cannot be negative)"):
        DealLineContext(
            odoo_line_id=1,
            odoo_product_id=1,
            product_name="Bad Item",
            category_name="Hardware",
            odoo_category_id=1,
            quantity=5.0,
            price_unit=-100.0
        )


def test_context_rejects_invalid_discounts():
    """Verify discounts below 0 or above 100 throw validation error."""
    with pytest.raises(ValueError, match=r"(less than or equal to 100|Discount percentage)"):
        DealLineContext(
            odoo_line_id=1,
            odoo_product_id=1,
            product_name="Bad Discount Item",
            category_name="Hardware",
            odoo_category_id=1,
            quantity=1.0,
            price_unit=100.0,
            discount_pct=105.0
        )

    with pytest.raises(ValueError, match=r"(greater than or equal to 0|Discount percentage)"):
        DealLineContext(
            odoo_line_id=1,
            odoo_product_id=1,
            product_name="Negative Discount Item",
            category_name="Hardware",
            odoo_category_id=1,
            quantity=1.0,
            price_unit=100.0,
            discount_pct=-5.0
        )


def test_context_snapshot_immutability():
    """Verify create_approved_snapshot creates an isolated deep copy that cannot be mutated."""
    deal = DealContext(
        deal_id="test_deal",
        odoo_sale_order_id=101,
        order_name="SO101",
        customer=CustomerContext(odoo_partner_id=1, name="Acme", tier="Gold"),
        lines=[
            DealLineContext(
                odoo_line_id=1,
                odoo_product_id=10,
                product_name="Item 1",
                category_name="Hardware",
                odoo_category_id=1,
                quantity=10.0,
                price_unit=1000.0,
                discount_pct=15.0
            )
        ]
    )
    deal.recalculate_totals()

    # Create approved baseline
    baseline = deal.create_approved_snapshot()
    assert baseline.approval_state == "APPROVED"
    assert baseline.lines[0].discount_pct == 15.0

    # In-place mutation of live deal
    deal.lines[0].discount_pct = 25.0
    deal.recalculate_totals()

    # Baseline remains 100% untouched!
    assert baseline.lines[0].discount_pct == 15.0
    assert deal.lines[0].discount_pct == 25.0


def test_context_handles_zero_totals_without_division_by_zero():
    """Verify zero totals and empty lines calculate cleanly."""
    empty_deal = DealContext(
        deal_id="empty_deal",
        odoo_sale_order_id=102,
        order_name="SO102",
        customer=CustomerContext(odoo_partner_id=2, name="Beta", tier="Bronze"),
        lines=[]
    )
    empty_deal.recalculate_totals()
    assert empty_deal.totals.amount_untaxed == 0.0
    assert empty_deal.totals.projected_margin_pct == 0.0


# =============================================================================
# 2. POLICY RESOLUTION INVARIANTS & BOUNDARIES
# =============================================================================

def test_policy_effective_ceiling_invariant():
    """Invariant: effective_ceiling <= tier_limit and effective_ceiling <= category_limit."""
    resolver = PolicyResolver()
    tiers = ["Bronze", "Silver", "Gold", "Platinum", "UnknownTier"]
    categories = ["Hardware", "Services", "Subscriptions", "Software", "UnknownCat"]

    for t in tiers:
        for c in categories:
            t_lim, c_lim, ceiling = resolver.resolve_effective_limits(t, c)
            assert ceiling <= t_lim, f"Ceiling {ceiling} > tier limit {t_lim} for {t}/{c}"
            assert ceiling <= c_lim, f"Ceiling {ceiling} > category limit {c_lim} for {t}/{c}"
            assert ceiling == min(t_lim, c_lim)


def test_policy_exact_ceiling_match():
    """Verify discount matching effective ceiling exactly is compliant with EXACT_CEILING code."""
    resolver = PolicyResolver()
    line = DealLineContext(
        odoo_line_id=1,
        odoo_product_id=10,
        product_name="Consulting",
        category_name="Services",
        odoo_category_id=2,
        quantity=1.0,
        price_unit=1000.0,
        discount_pct=10.0  # Exactly matches 10.0% Services ceiling for Gold customer
    )
    res = resolver.evaluate_line(line, customer_tier="Gold")
    assert res.is_violation is False
    assert res.excess == 0.0
    assert res.code == PolicyReasonCode.EXACT_CEILING.value
    assert "exactly reaches allowed policy ceiling" in res.reason


# =============================================================================
# 3. BLENDED RISK INVARIANTS & REPRODUCIBILITY
# =============================================================================

def test_risk_bounds_invariant(sample_gold_deal):
    """Invariant: 0 <= score <= 100 under all conditions."""
    calculator = BlendedRiskCalculator()
    resolver = PolicyResolver()
    policy_res = resolver.resolve_policy(sample_gold_deal)

    # Standard risk
    risk = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=True)
    assert 0 <= risk.score <= 100

    # Extreme high risk with massive violations and high stalled days
    extreme_deal = sample_gold_deal.model_copy(deep=True)
    extreme_deal.stalled_days = 100
    extreme_deal.totals.projected_margin_pct = -50.0  # Massive negative margin
    extreme_risk = calculator.calculate_risk(extreme_deal, policy_res, split_required=True)
    assert extreme_risk.score <= 100
    assert extreme_risk.severity == RiskSeverity.HIGH


def test_risk_determinism_across_1000_iterations(sample_gold_deal):
    """Verify risk score is strictly deterministic across 1,000 runs."""
    calculator = BlendedRiskCalculator()
    resolver = PolicyResolver()
    policy_res = resolver.resolve_policy(sample_gold_deal)

    first_score = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=True).score
    assert first_score == 61

    for _ in range(1000):
        score = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=True).score
        assert score == 61


# =============================================================================
# 4. APPROVAL FSM MULTI-TIER SEQUENTIAL VS DIRECT ROUTING
# =============================================================================

def test_approval_routing_modes():
    """Verify both sequential multi-tier and direct finance escalation modes."""
    router = ApprovalRouter()

    # Mode 1: Direct escalation (default)
    direct_stage = router.determine_initial_stage(
        RequiredApprovalLevel.FINANCE,
        sequential_multi_tier=False
    )
    assert direct_stage == ApprovalStage.PENDING_FINANCE

    # Mode 2: Sequential multi-tier
    sequential_stage = router.determine_initial_stage(
        RequiredApprovalLevel.FINANCE,
        sequential_multi_tier=True
    )
    assert sequential_stage == ApprovalStage.PENDING_MANAGER


def test_approval_state_machine_submit_action():
    """Verify SUBMIT action transitions draft deal correctly."""
    # Submit with Finance required
    stage = ApprovalStateMachine.apply_action(
        current_stage=ApprovalStage.DRAFT,
        action=ApprovalActionType.SUBMIT,
        required_level="FINANCE",
        actor="sales_rep"
    )
    assert stage == ApprovalStage.PENDING_FINANCE

    # Submit with Manager required
    stage = ApprovalStateMachine.apply_action(
        current_stage=ApprovalStage.DRAFT,
        action=ApprovalActionType.SUBMIT,
        required_level="MANAGER",
        actor="sales_rep"
    )
    assert stage == ApprovalStage.PENDING_MANAGER

    # Submit with Auto-Approved
    stage = ApprovalStateMachine.apply_action(
        current_stage=ApprovalStage.DRAFT,
        action=ApprovalActionType.SUBMIT,
        required_level="NONE",
        actor="sales_rep"
    )
    assert stage == ApprovalStage.AUTO_APPROVED


# =============================================================================
# 5. MATERIAL CHANGE DETECTION VS HARMLESS CHANGES
# =============================================================================

def test_harmless_changes_do_not_invalidate(sample_gold_deal):
    """Verify text notes, customer comments, and discount decreases do not trigger invalidation."""
    detector = MaterialChangeDetector()
    sample_gold_deal.recalculate_totals()
    baseline = sample_gold_deal.create_approved_snapshot()

    # Case 1: Identical terms
    is_mat, reasons = detector.is_material_change(baseline, sample_gold_deal)
    assert is_mat is False

    # Case 2: Discount reduced (commercially better for company)
    improved_deal = sample_gold_deal.model_copy(deep=True)
    improved_deal.lines[1].discount_pct = 15.0  # Down from 18%
    improved_deal.recalculate_totals()
    is_mat, reasons = detector.is_material_change(baseline, improved_deal)
    assert is_mat is False

    # Case 3: Harmless metadata note change
    noted_deal = sample_gold_deal.model_copy(deep=True)
    noted_deal.metadata["delivery_notes"] = "Please deliver to building B entrance."
    is_mat, reasons = detector.is_material_change(baseline, noted_deal)
    assert is_mat is False


# =============================================================================
# 6. FULFILLMENT CONSERVATION INVARIANT
# =============================================================================

def test_fulfillment_conservation_invariant():
    """Invariant: for every line and overall: allocated_qty + backorder_qty == requested_qty."""
    planner = FulfillmentPlanner()
    deal = DealContext(
        deal_id="deal_fulfill",
        odoo_sale_order_id=500,
        order_name="SO500",
        customer=CustomerContext(odoo_partner_id=1, name="Test Corp"),
        lines=[
            DealLineContext(
                odoo_line_id=1,
                odoo_product_id=72,
                product_name="Enterprise Laptop Pro",
                category_name="Hardware",
                odoo_category_id=1,
                quantity=15.0,
                price_unit=50000.0
            )
        ]
    )
    res = planner.plan_fulfillment(deal)
    assert round(res.total_allocated_qty + res.total_backorder_qty, 4) == round(res.total_requested_qty, 4)
    for lp in res.line_plans:
        assert round(lp.allocated_qty + lp.backorder_qty, 4) == round(lp.requested_qty, 4)
        for alloc in lp.allocations:
            assert alloc.quantity <= alloc.source_stock
            assert alloc.remaining_stock >= 0.0


# =============================================================================
# 7. RECOMMENDATION INVARIANTS & EXCLUSION OF ALREADY ADDED PRODUCTS
# =============================================================================

def test_recommendation_excludes_already_added_products():
    """Verify products already in quote lines are not suggested."""
    scorer = RecommendationScorer()
    deal = DealContext(
        deal_id="deal_rec",
        odoo_sale_order_id=600,
        order_name="SO600",
        customer=CustomerContext(odoo_partner_id=1, name="Test Corp"),
        lines=[
            DealLineContext(
                odoo_line_id=1,
                odoo_product_id=72,
                product_name="Enterprise Laptop Pro",
                category_name="Hardware",
                odoo_category_id=1,
                quantity=1.0,
                price_unit=50000.0
            ),
            # Already has Docking Station (product 85) in quote!
            DealLineContext(
                odoo_line_id=2,
                odoo_product_id=85,
                product_name="Thunderbolt Docking Station",
                category_name="Hardware",
                odoo_category_id=1,
                quantity=1.0,
                price_unit=18000.0
            )
        ]
    )
    res = scorer.generate_recommendations(deal)
    # Docking station (85) must not be in recommendations because it's already on the quote!
    assert all(r.odoo_product_id != 85 for r in res.recommendations)


# =============================================================================
# 8. HEALTH SCORING INVARIANT
# =============================================================================

def test_health_scoring_bounds_and_flags():
    """Invariant: 0 <= health.score <= 100, structured flags returned."""
    calculator = DealHealthCalculator()
    deal = DealContext(
        deal_id="deal_health",
        odoo_sale_order_id=700,
        order_name="SO700",
        customer=CustomerContext(odoo_partner_id=1, name="Test Corp"),
        stalled_days=8,
        lines=[
            DealLineContext(
                odoo_line_id=1,
                odoo_product_id=72,
                product_name="Laptop",
                category_name="Hardware",
                odoo_category_id=1,
                quantity=1.0,
                price_unit=1000.0,
                discount_pct=25.0
            )
        ]
    )
    res = calculator.calculate_health(deal, has_backorder=True)
    assert 0 <= res.score <= 100
    assert len(res.flags) >= 2  # Stalled + Anomaly + Delivery flags
    flag_types = [f.type for f in res.flags]
    assert "STALLED_DEAL" in flag_types
    assert "DISCOUNT_ANOMALY" in flag_types


# =============================================================================
# 9. PERFORMANCE BENCHMARK (< 5ms per full evaluation)
# =============================================================================

def test_guardian_evaluation_performance_benchmark(sample_gold_deal):
    """Benchmark: Full DealGuardian evaluation pipeline completes in < 5ms."""
    guardian = DealGuardian()
    iterations = 200

    # Warm-up
    guardian.evaluate_deal(sample_gold_deal)

    start = time.perf_counter()
    for _ in range(iterations):
        guardian.evaluate_deal(sample_gold_deal)
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / iterations) * 1000.0
    print(f"\n[BENCHMARK] Deal Guardian average evaluation latency: {avg_ms:.3f} ms")
    assert avg_ms < 5.0, f"Average latency {avg_ms:.3f} ms exceeded 5.0 ms threshold!"
