"""Unit tests for GOV-03 Approval State Machine & Router."""

import pytest
from app.governance.approval.state_machine import (
    ApprovalStage,
    ApprovalActionType,
    ApprovalStateMachine
)
from app.governance.approval.router import ApprovalRouter, RequiredApprovalLevel
from app.governance.risk.factors import RiskAssessmentResult, RiskSeverity
from app.governance.policy.models import PolicyResolutionResult, LinePolicyResult


def test_approval_routing_thresholds():
    """Verify router maps risk scores correctly to required approval level."""
    router = ApprovalRouter(manager_score_cutoff=20, finance_score_cutoff=50)

    empty_policy = PolicyResolutionResult(line_results=[], has_violations=False)

    # Low risk -> None
    low_risk = RiskAssessmentResult(score=12, severity=RiskSeverity.LOW)
    assert router.determine_required_level(low_risk, empty_policy) == RequiredApprovalLevel.NONE

    # Medium risk -> Manager
    med_risk = RiskAssessmentResult(score=35, severity=RiskSeverity.MEDIUM)
    assert router.determine_required_level(med_risk, empty_policy) == RequiredApprovalLevel.MANAGER

    # High risk -> Finance
    high_risk = RiskAssessmentResult(score=61, severity=RiskSeverity.HIGH)
    assert router.determine_required_level(high_risk, empty_policy) == RequiredApprovalLevel.FINANCE


def test_legal_multi_step_approval_workflow():
    """Verify progression from Draft to Manager to Finance to Approved."""
    stage = ApprovalStage.DRAFT

    # Transition to Pending Manager
    stage = ApprovalStateMachine.transition(stage, ApprovalStage.PENDING_MANAGER, actor="rep1")
    assert stage == ApprovalStage.PENDING_MANAGER

    # Manager approves, forwarding to Finance because required level is FINANCE
    stage = ApprovalStateMachine.apply_action(
        current_stage=stage,
        action=ApprovalActionType.APPROVE,
        required_level="FINANCE",
        actor="manager_alice"
    )
    assert stage == ApprovalStage.PENDING_FINANCE

    # Finance gives final approval
    stage = ApprovalStateMachine.apply_action(
        current_stage=stage,
        action=ApprovalActionType.APPROVE,
        required_level="FINANCE",
        actor="finance_bob"
    )
    assert stage == ApprovalStage.APPROVED


def test_illegal_approval_transition_rejected():
    """Verify illegal jumps throw ValueError."""
    with pytest.raises(ValueError, match="Illegal approval transition"):
        # Cannot jump directly from DRAFT to APPROVED if not auto-approved
        ApprovalStateMachine.transition(ApprovalStage.DRAFT, ApprovalStage.APPROVED, actor="rep1")

    with pytest.raises(ValueError, match="Illegal approval transition"):
        # Cannot jump directly from REJECTED to APPROVED
        ApprovalStateMachine.transition(ApprovalStage.REJECTED, ApprovalStage.APPROVED, actor="rep1")


def test_rejection_and_return_transitions():
    """Verify reject and return-for-revision action handling."""
    stage = ApprovalStage.PENDING_MANAGER

    # Return for revision
    stage = ApprovalStateMachine.apply_action(
        stage, ApprovalActionType.RETURN, "MANAGER", actor="manager_alice", reason="Too discounted"
    )
    assert stage == ApprovalStage.RETURNED_FOR_REVISION

    # Can return to draft
    stage = ApprovalStateMachine.transition(stage, ApprovalStage.DRAFT, actor="rep1")
    assert stage == ApprovalStage.DRAFT
