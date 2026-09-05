"""Unit tests for GOV-05 Deal Guardian Master Orchestrator."""

from app.governance.guardian import DealGuardian
from app.governance.approval.state_machine import ApprovalStage


def test_deal_guardian_full_pipeline_evaluation(sample_gold_deal):
    """Verify Deal Guardian runs the complete governance pipeline and produces Contract 2 snapshot."""
    guardian = DealGuardian()
    result = guardian.evaluate_deal(sample_gold_deal)

    # 1. Identity & Risk
    assert result.deal_id == sample_gold_deal.deal_id
    assert result.risk.score == 61
    assert result.risk.severity.value == "HIGH"
    assert len(result.risk.factors) >= 3

    # 2. Approval Routing
    assert result.approval.required is True
    assert result.approval.level == "FINANCE"
    assert result.approval.current_stage == ApprovalStage.PENDING_FINANCE

    # 3. Policy
    assert result.policy.has_violations is True
    assert result.policy.max_excess == 8.0

    # 4. Recommendations
    assert len(result.recommendations.recommendations) > 0
    assert result.recommendations.recommendations[0].product_name == "Thunderbolt Docking Station"

    # 5. Fulfillment
    assert result.fulfillment.split_required is True
    assert result.fulfillment.estimated_shipments == 2

    # 6. Next Best Action
    assert result.next_best_action.type == "FINANCE_APPROVAL_REQUIRED"
    assert result.next_best_action.priority == "HIGH"
    assert "Finance Approval Required" in result.next_best_action.title

    # 7. Audit Logging
    assert result.audit_events_count >= 1


def test_deal_guardian_compliant_auto_approve(sample_compliant_deal):
    """Verify compliant deal is auto-approved with low risk."""
    guardian = DealGuardian()
    result = guardian.evaluate_deal(sample_compliant_deal)

    assert result.risk.score < 20
    assert result.approval.required is False
    assert result.approval.current_stage == ApprovalStage.AUTO_APPROVED
    assert result.next_best_action.type == "CONFIRM_QUOTATION"
