"""Approval Router (GOV-03).

Determines required approval levels based on risk scores and policy thresholds.
"""

from enum import Enum
from ..risk.factors import RiskAssessmentResult, RiskSeverity
from ..policy.models import PolicyResolutionResult


class RequiredApprovalLevel(str, Enum):
    NONE = "NONE"
    MANAGER = "MANAGER"
    FINANCE = "FINANCE"


class ApprovalRouter:
    """Routes deals to the appropriate governance authority."""

    def __init__(self, manager_score_cutoff: int = 20, finance_score_cutoff: int = 50):
        self.manager_score_cutoff = manager_score_cutoff
        self.finance_score_cutoff = finance_score_cutoff

    def determine_required_level(
        self,
        risk_result: RiskAssessmentResult,
        policy_result: PolicyResolutionResult
    ) -> RequiredApprovalLevel:
        """Determine whether deal requires Auto, Manager, or Finance approval."""
        # 1. Check direct policy threshold breaches (e.g. line discount > finance threshold)
        for line in policy_result.line_results:
            if line.excess >= 15.0:  # Direct Finance breach
                return RequiredApprovalLevel.FINANCE

        # 2. Check blended risk score
        if risk_result.score > self.finance_score_cutoff:
            return RequiredApprovalLevel.FINANCE

        if risk_result.score >= self.manager_score_cutoff or policy_result.has_violations:
            return RequiredApprovalLevel.MANAGER

        return RequiredApprovalLevel.NONE

    def determine_initial_stage(
        self,
        required_level: RequiredApprovalLevel,
        sequential_multi_tier: bool = False
    ):
        """Determine initial approval stage from required level.
        
        Args:
            required_level: NONE, MANAGER, or FINANCE
            sequential_multi_tier: If True, FINANCE approvals start at PENDING_MANAGER
                before escalating to PENDING_FINANCE upon Manager signoff.
                If False (default), high-risk deals route directly to PENDING_FINANCE queue.
        """
        from .state_machine import ApprovalStage
        if required_level == RequiredApprovalLevel.NONE:
            return ApprovalStage.AUTO_APPROVED
        elif required_level == RequiredApprovalLevel.MANAGER:
            return ApprovalStage.PENDING_MANAGER
        elif required_level == RequiredApprovalLevel.FINANCE:
            return ApprovalStage.PENDING_MANAGER if sequential_multi_tier else ApprovalStage.PENDING_FINANCE
        return ApprovalStage.DRAFT
