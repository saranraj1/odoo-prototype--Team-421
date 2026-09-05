"""Unit tests for GOV-02 Blended Risk Engine."""

from app.governance.policy.resolver import PolicyResolver
from app.governance.risk.calculator import BlendedRiskCalculator, RiskWeightConfig
from app.governance.risk.factors import RiskSeverity


def test_zero_violation_risk(sample_compliant_deal):
    """Verify compliant deal has low risk."""
    sample_compliant_deal.recalculate_totals()
    policy_resolver = PolicyResolver()
    policy_res = policy_resolver.resolve_policy(sample_compliant_deal)

    calculator = BlendedRiskCalculator()
    risk_res = calculator.calculate_risk(sample_compliant_deal, policy_res, split_required=False)

    assert risk_res.score < 20
    assert risk_res.severity == RiskSeverity.LOW
    assert len(risk_res.factors) == 0


def test_demo_deal_blended_risk_calculation(sample_gold_deal):
    """Verify standard demo deal calculation producing HIGH severity (Score 61)."""
    sample_gold_deal.recalculate_totals()
    policy_resolver = PolicyResolver()
    policy_res = policy_resolver.resolve_policy(sample_gold_deal)

    calculator = BlendedRiskCalculator()
    # In the demo: discount excess + margin exposure + warehouse split
    risk_res = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=True)

    assert risk_res.score == 61
    assert risk_res.severity == RiskSeverity.HIGH

    factor_types = [f.type for f in risk_res.factors]
    assert "DISCOUNT_EXCESS" in factor_types
    assert "MARGIN_EXPOSURE" in factor_types
    assert "FULFILLMENT_SPLIT" in factor_types

    # Check specific explainability reasons
    excess_factor = next(f for f in risk_res.factors if f.type == "DISCOUNT_EXCESS")
    assert excess_factor.contribution == 38
    assert "exceeds Services ceiling (10.0%) by 8.0%" in excess_factor.reason

    margin_factor = next(f for f in risk_res.factors if f.type == "MARGIN_EXPOSURE")
    assert margin_factor.contribution == 15

    fulfillment_factor = next(f for f in risk_res.factors if f.type == "FULFILLMENT_SPLIT")
    assert fulfillment_factor.contribution == 8


def test_accumulated_multi_line_risk(sample_gold_deal):
    """Verify that multiple small violations accumulate into meaningful overall risk."""
    # Add another line that slightly breaches its ceiling
    from app.governance.context import DealLineContext
    sample_gold_deal.lines.append(
        DealLineContext(
            odoo_line_id=203,
            odoo_product_id=90,
            product_name="Cloud Subscription Addon",
            category_name="Subscriptions",
            odoo_category_id=14,
            quantity=5.0,
            price_unit=10000.0,
            cost_unit=8000.0,
            discount_pct=16.0,  # Ceiling is 12% -> 4% excess
        )
    )
    sample_gold_deal.recalculate_totals()

    policy_resolver = PolicyResolver()
    policy_res = policy_resolver.resolve_policy(sample_gold_deal)
    calculator = BlendedRiskCalculator()
    risk_res = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=False)

    assert risk_res.score > 50
    assert risk_res.severity == RiskSeverity.HIGH
    assert len([f for f in risk_res.factors if f.type == "DISCOUNT_EXCESS"]) == 2


def test_score_upper_bound(sample_gold_deal):
    """Verify risk score never exceeds 100 even with extreme penalties."""
    # Set extreme 90% discount
    sample_gold_deal.lines[1].discount_pct = 90.0
    sample_gold_deal.recalculate_totals()

    policy_resolver = PolicyResolver()
    policy_res = policy_resolver.resolve_policy(sample_gold_deal)
    calculator = BlendedRiskCalculator()
    risk_res = calculator.calculate_risk(sample_gold_deal, policy_res, split_required=True)

    assert risk_res.score <= 100
    assert risk_res.severity == RiskSeverity.HIGH
