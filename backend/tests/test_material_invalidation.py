"""Unit tests for GOV-04 Material Change Detection & Approval Invalidation."""

from app.governance.approval.invalidation import MaterialChangeDetector
from app.governance.approval.state_machine import ApprovalStage
from app.governance.context import DealContext, DealLineContext


def test_killer_scenario_customer_counteroffer_invalidates_approval(sample_gold_deal):
    """THE KILLER TEST: Customer counters with 22% on Setup Service -> Approval Invalidated!"""
    sample_gold_deal.recalculate_totals()
    approved_baseline = sample_gold_deal

    # Clone deal and apply customer counteroffer: 22% discount on Setup Service (line 202)
    proposed_data = approved_baseline.model_dump()
    proposed_deal = DealContext.model_validate(proposed_data)
    service_line = next(l for l in proposed_deal.lines if l.odoo_line_id == 202)
    service_line.discount_pct = 22.0  # Counteroffer exceeds approved 18%!
    proposed_deal.recalculate_totals()

    detector = MaterialChangeDetector()
    inv_res = detector.evaluate_invalidation(
        current_stage=ApprovalStage.APPROVED,
        approved_baseline=approved_baseline,
        proposed_state=proposed_deal
    )

    assert inv_res.is_material is True
    assert inv_res.approval_invalidated is True
    assert inv_res.previous_approval_stage == ApprovalStage.APPROVED
    assert inv_res.resulting_approval_stage == ApprovalStage.INVALIDATED
    assert any("increased from approved 18.0% to 22.0%" in r for r in inv_res.reasons)


def test_identical_terms_do_not_invalidate(sample_gold_deal):
    """Customer accepts approved terms (18% discount) -> Approval stays APPROVED."""
    sample_gold_deal.recalculate_totals()
    approved_baseline = sample_gold_deal

    proposed_data = approved_baseline.model_dump()
    proposed_deal = DealContext.model_validate(proposed_data)
    proposed_deal.recalculate_totals()

    detector = MaterialChangeDetector()
    inv_res = detector.evaluate_invalidation(
        current_stage=ApprovalStage.APPROVED,
        approved_baseline=approved_baseline,
        proposed_state=proposed_deal
    )

    assert inv_res.is_material is False
    assert inv_res.approval_invalidated is False
    assert inv_res.resulting_approval_stage == ApprovalStage.APPROVED


def test_discount_decrease_does_not_invalidate(sample_gold_deal):
    """Customer asks for less discount (15% instead of approved 18%) -> Not material."""
    sample_gold_deal.recalculate_totals()
    approved_baseline = sample_gold_deal

    proposed_data = approved_baseline.model_dump()
    proposed_deal = DealContext.model_validate(proposed_data)
    proposed_deal.lines[1].discount_pct = 15.0  # Reduced discount
    proposed_deal.recalculate_totals()

    detector = MaterialChangeDetector()
    inv_res = detector.evaluate_invalidation(
        current_stage=ApprovalStage.APPROVED,
        approved_baseline=approved_baseline,
        proposed_state=proposed_deal
    )

    assert inv_res.is_material is False
    assert inv_res.approval_invalidated is False
    assert inv_res.resulting_approval_stage == ApprovalStage.APPROVED


def test_adding_new_discounted_line_after_approval_is_material(sample_gold_deal):
    """Adding a new discounted product after approval must trigger invalidation."""
    sample_gold_deal.recalculate_totals()
    approved_baseline = sample_gold_deal

    proposed_data = approved_baseline.model_dump()
    proposed_deal = DealContext.model_validate(proposed_data)
    proposed_deal.lines.append(
        DealLineContext(
            odoo_line_id=205,
            odoo_product_id=999,
            product_name="Extra Server",
            category_name="Hardware",
            odoo_category_id=8,
            quantity=1.0,
            price_unit=80000.0,
            discount_pct=25.0  # Substantial discount added
        )
    )
    proposed_deal.recalculate_totals()

    detector = MaterialChangeDetector()
    inv_res = detector.evaluate_invalidation(
        current_stage=ApprovalStage.APPROVED,
        approved_baseline=approved_baseline,
        proposed_state=proposed_deal
    )

    assert inv_res.is_material is True
    assert inv_res.approval_invalidated is True
    assert any("Extra Server" in r for r in inv_res.reasons)
