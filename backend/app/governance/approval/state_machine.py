"""Approval State Machine (GOV-03).

Implements strict approval lifecycle states, legal transitions, and action processing.
"""

from enum import Enum
from typing import Optional, List, Dict, Set
from pydantic import BaseModel, Field


class ApprovalStage(str, Enum):
    DRAFT = "DRAFT"
    AUTO_APPROVED = "AUTO_APPROVED"
    PENDING_MANAGER = "PENDING_MANAGER"
    PENDING_FINANCE = "PENDING_FINANCE"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED_FOR_REVISION = "RETURNED_FOR_REVISION"
    INVALIDATED = "INVALIDATED"


class ApprovalActionType(str, Enum):
    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    RETURN = "RETURN"
    INVALIDATE = "INVALIDATE"


class ApprovalStateResult(BaseModel):
    """Current state of approval workflow for a deal."""
    current_stage: ApprovalStage
    required_level: str  # NONE, MANAGER, FINANCE
    is_approved: bool = False
    is_pending: bool = False
    is_invalidated: bool = False
    history_actions: List[Dict[str, str]] = Field(default_factory=list)
    active_reviewer_role: Optional[str] = None


# Valid state transitions
LEGAL_TRANSITIONS: Dict[ApprovalStage, Set[ApprovalStage]] = {
    ApprovalStage.DRAFT: {
        ApprovalStage.AUTO_APPROVED,
        ApprovalStage.PENDING_MANAGER,
        ApprovalStage.PENDING_FINANCE,
    },
    ApprovalStage.AUTO_APPROVED: {
        ApprovalStage.APPROVED,
        ApprovalStage.INVALIDATED,
    },
    ApprovalStage.PENDING_MANAGER: {
        ApprovalStage.PENDING_FINANCE,
        ApprovalStage.APPROVED,
        ApprovalStage.REJECTED,
        ApprovalStage.RETURNED_FOR_REVISION,
        ApprovalStage.INVALIDATED,
    },
    ApprovalStage.PENDING_FINANCE: {
        ApprovalStage.APPROVED,
        ApprovalStage.REJECTED,
        ApprovalStage.RETURNED_FOR_REVISION,
        ApprovalStage.INVALIDATED,
    },
    ApprovalStage.APPROVED: {
        ApprovalStage.INVALIDATED,  # Customer counteroffer triggers invalidation
    },
    ApprovalStage.INVALIDATED: {
        ApprovalStage.PENDING_MANAGER,
        ApprovalStage.PENDING_FINANCE,
        ApprovalStage.APPROVED,
    },
    ApprovalStage.RETURNED_FOR_REVISION: {
        ApprovalStage.DRAFT,
        ApprovalStage.PENDING_MANAGER,
    },
    ApprovalStage.REJECTED: set(),  # Terminal state until new revision
}


class ApprovalStateMachine:
    """Manages legal approval state transitions and guards against invalid jumps."""

    @staticmethod
    def transition(
        current_stage: ApprovalStage,
        target_stage: ApprovalStage,
        actor: str,
        reason: str = ""
    ) -> ApprovalStage:
        """Attempt to transition between approval stages."""
        allowed = LEGAL_TRANSITIONS.get(current_stage, set())
        if target_stage not in allowed:
            raise ValueError(
                f"Illegal approval transition: Cannot move from {current_stage.value} to {target_stage.value}."
            )
        return target_stage

    @staticmethod
    def apply_action(
        current_stage: ApprovalStage,
        action: ApprovalActionType,
        required_level: str,
        actor: str,
        reason: str = ""
    ) -> ApprovalStage:
        """Apply a business approval action according to current required level."""
        if action == ApprovalActionType.SUBMIT:
            if current_stage == ApprovalStage.DRAFT:
                if required_level == "NONE":
                    return ApprovalStateMachine.transition(current_stage, ApprovalStage.AUTO_APPROVED, actor, reason)
                elif required_level == "FINANCE":
                    return ApprovalStateMachine.transition(current_stage, ApprovalStage.PENDING_FINANCE, actor, reason)
                else:
                    return ApprovalStateMachine.transition(current_stage, ApprovalStage.PENDING_MANAGER, actor, reason)
            raise ValueError(f"Cannot submit deal already in {current_stage.value} stage.")

        if action == ApprovalActionType.INVALIDATE:
            return ApprovalStateMachine.transition(current_stage, ApprovalStage.INVALIDATED, actor, reason)

        if action == ApprovalActionType.REJECT:
            return ApprovalStateMachine.transition(current_stage, ApprovalStage.REJECTED, actor, reason)

        if action == ApprovalActionType.RETURN:
            return ApprovalStateMachine.transition(current_stage, ApprovalStage.RETURNED_FOR_REVISION, actor, reason)

        if action == ApprovalActionType.APPROVE:
            if current_stage == ApprovalStage.PENDING_MANAGER:
                # If required level is FINANCE, Manager approval moves to PENDING_FINANCE
                if required_level == "FINANCE":
                    return ApprovalStateMachine.transition(
                        current_stage, ApprovalStage.PENDING_FINANCE, actor, "Sales Manager approved, forwarded to Finance"
                    )
                else:
                    return ApprovalStateMachine.transition(current_stage, ApprovalStage.APPROVED, actor, reason)

            elif current_stage in (ApprovalStage.PENDING_FINANCE, ApprovalStage.AUTO_APPROVED):
                return ApprovalStateMachine.transition(current_stage, ApprovalStage.APPROVED, actor, reason)

            elif current_stage == ApprovalStage.APPROVED:
                # Idempotent re-approval
                return ApprovalStage.APPROVED

            else:
                raise ValueError(f"Cannot approve deal currently in {current_stage.value} stage.")

        raise ValueError(f"Unknown approval action: {action}")
