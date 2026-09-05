"""End-to-End Governance Test: The Killer Demo Flow.

Simulates the full 8-step lifecycle:
Quote -> 18% Service discount -> Risk = 61 -> Finance Approval -> Approved Baseline Stored
-> Customer Portal counters with 22% -> Material Change Detected -> Approval INVALIDATED
-> Risk Recalculated -> Re-Approval Required -> Manager Alerted.
"""

from app.governance.guardian import DealGuardian
from app.governance.approval.state_machine import ApprovalStage, ApprovalActionType, ApprovalStateMachine
from app.governance.negotiation.evaluator import CustomerNegotiationRequest, NegotiationEvaluator


def test_killer_demo_governance_flow(sample_gold_deal):
    """Execute the exact hackathon demo flow through the Deal Guardian."""
    guardian = DealGuardian()

    # =========================================================================
    # STEP 1: Sales Rep builds quote with 18% discount on Setup Service
    # =========================================================================
    step1_res = guardian.evaluate_deal(sample_gold_deal)

    assert step1_res.risk.score == 61
    assert step1_res.approval.level == "FINANCE"
    assert step1_res.approval.current_stage == ApprovalStage.PENDING_FINANCE
    assert step1_res.next_best_action.type == "FINANCE_APPROVAL_REQUIRED"

    # =========================================================================
    # STEP 2: Rep adds Recommended Docking Station -> Margin improves!
    # =========================================================================
    top_rec = step1_res.recommendations.recommendations[0]
    assert top_rec.product_name == "Thunderbolt Docking Station"
    assert top_rec.margin_delta == 13000.0

    # =========================================================================
    # STEP 3: Finance Approves Deal -> State becomes APPROVED
    # =========================================================================
    approved_stage = ApprovalStateMachine.apply_action(
        current_stage=step1_res.approval.current_stage,
        action=ApprovalActionType.APPROVE,
        required_level="FINANCE",
        actor="finance_officer",
        reason="Strategic deal approved for Q3 targets."
    )
    assert approved_stage == ApprovalStage.APPROVED

    # Save snapshot of approved baseline
    approved_baseline_data = sample_gold_deal.model_dump()
    approved_baseline_data["approval_state"] = ApprovalStage.APPROVED.value
    from app.governance.context import DealContext
    approved_baseline = DealContext.model_validate(approved_baseline_data)
    approved_baseline.recalculate_totals()

    # Verify Guardian recognizes approved state and flags warehouse split
    step3_res = guardian.evaluate_deal(
        context=approved_baseline,
        approved_baseline=approved_baseline,
        current_stage=ApprovalStage.APPROVED
    )
    assert step3_res.approval.current_stage == ApprovalStage.APPROVED
    assert step3_res.approval.invalidated is False
    assert step3_res.next_best_action.type == "FULFILLMENT_SPLIT_REQUIRED"

    # Sales rep accepts the suggested warehouse allocation split
    approved_baseline.metadata["split_accepted"] = True
    step3b_res = guardian.evaluate_deal(
        context=approved_baseline,
        approved_baseline=approved_baseline,
        current_stage=ApprovalStage.APPROVED
    )
    assert step3b_res.next_best_action.type == "CONFIRM_QUOTATION"

    # =========================================================================
    # STEP 4: Customer opens portal and counters with 22% discount
    # =========================================================================
    neg_request = CustomerNegotiationRequest(
        deal_id=sample_gold_deal.deal_id,
        odoo_sale_order_id=sample_gold_deal.odoo_sale_order_id,
        requested_by="Customer Procurement",
        message="We need 22% on Setup Service to close today.",
        requested_discounts={202: 22.0}  # Line 202 = Setup Service
    )

    neg_evaluator = NegotiationEvaluator()
    neg_res = neg_evaluator.evaluate_negotiation(
        approved_baseline=approved_baseline,
        current_context=approved_baseline,
        request=neg_request
    )

    assert neg_res.is_material is True
    assert neg_res.requires_reapproval is True
    assert any("increased from approved 18.0% to 22.0%" in r for r in neg_res.reasons)

    # =========================================================================
    # STEP 5: THE KILLER MOMENT — Deal Guardian re-evaluates proposed state
    # =========================================================================
    step5_res = guardian.evaluate_deal(
        context=neg_res.proposed_context,
        approved_baseline=approved_baseline,
        current_stage=ApprovalStage.APPROVED  # Was approved prior to counteroffer
    )

    # 1. Previous approval is marked INVALIDATED
    assert step5_res.approval.invalidated is True

    # 2. Risk is recalculated (and increases due to deeper discount!)
    assert step5_res.risk.score >= 61

    # 3. State resets to PENDING_FINANCE for re-approval
    assert step5_res.approval.current_stage == ApprovalStage.PENDING_FINANCE

    # 4. Next Best Action tells Manager / Rep that Re-Approval is required!
    assert step5_res.next_best_action.type == "RE_APPROVAL_REQUIRED"
    assert "Executive Re-Approval Required" in step5_res.next_best_action.title

    # 5. Audit event logged for invalidation
    assert any(
        e.get("event_type") == "APPROVAL_INVALIDATED"
        for e in guardian.audit_logger.events
    )
