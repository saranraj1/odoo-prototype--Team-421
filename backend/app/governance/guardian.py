"""Deal Guardian Orchestrator (GOV-05).

The central intelligence of the DealFlow360 platform.
Continuously evaluates deal state, calculates risk and operational feasibility,
manages approval lifecycles, detects invalidations, and guides the next best action.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .context import DealContext
from .interfaces import AuditLoggerProtocol, InMemoryAuditLogger
from .policy.resolver import PolicyResolver
from .policy.models import PolicyResolutionResult
from .risk.calculator import BlendedRiskCalculator
from .risk.factors import RiskAssessmentResult, RiskSeverity
from .risk.explain import RiskExplainer
from .approval.state_machine import ApprovalStage, ApprovalStateMachine, ApprovalActionType
from .approval.router import ApprovalRouter, RequiredApprovalLevel
from .approval.invalidation import MaterialChangeDetector, InvalidationResult
from .recommendation.scorer import RecommendationScorer, RecommendationResult
from .fulfillment.planner import FulfillmentPlanner, FulfillmentPlanResult
from .health.calculator import DealHealthCalculator, DealHealthResult, HealthStatus


class NextBestAction(BaseModel):
    """The primary operational guidance synthesized by the Deal Guardian."""
    type: str = Field(description="FINANCE_APPROVAL_REQUIRED, RE_APPROVAL_REQUIRED, etc.")
    action_code: str = Field(default="", description="Machine-readable code matching type")
    priority: str = Field(default="HIGH", description="HIGH, MEDIUM, LOW")
    title: str
    description: str
    action_cta: Optional[str] = None
    target_role: str = Field(default="SALES_REP", description="SALES_REP, MANAGER, CUSTOMER")


class GuardianApprovalSummary(BaseModel):
    """Summary of the approval state for the Deal Guardian snapshot."""
    required: bool
    level: str  # NONE, MANAGER, FINANCE
    current_stage: ApprovalStage
    invalidated: bool = False
    reasons: List[str] = Field(default_factory=list)


class GuardianEvaluationResult(BaseModel):
    """Complete Contract 2 Decision Snapshot returned to Frontend and API Gateway."""
    deal_id: str
    risk: RiskAssessmentResult
    approval: GuardianApprovalSummary
    policy: PolicyResolutionResult
    recommendations: RecommendationResult
    fulfillment: FulfillmentPlanResult
    health: DealHealthResult
    next_best_action: NextBestAction
    narrative_explanation: str
    audit_events_count: int = 0


class DealGuardian:
    """Deal Guardian Orchestrator executing the complete governance pipeline."""

    def __init__(
        self,
        policy_resolver: Optional[PolicyResolver] = None,
        risk_calculator: Optional[BlendedRiskCalculator] = None,
        approval_router: Optional[ApprovalRouter] = None,
        material_detector: Optional[MaterialChangeDetector] = None,
        recommendation_scorer: Optional[RecommendationScorer] = None,
        fulfillment_planner: Optional[FulfillmentPlanner] = None,
        health_calculator: Optional[DealHealthCalculator] = None,
        audit_logger: Optional[AuditLoggerProtocol] = None,
    ):
        self.policy_resolver = policy_resolver or PolicyResolver()
        self.risk_calculator = risk_calculator or BlendedRiskCalculator()
        self.approval_router = approval_router or ApprovalRouter()
        self.material_detector = material_detector or MaterialChangeDetector()
        self.recommendation_scorer = recommendation_scorer or RecommendationScorer()
        self.fulfillment_planner = fulfillment_planner or FulfillmentPlanner()
        self.health_calculator = health_calculator or DealHealthCalculator()
        self.audit_logger = audit_logger or InMemoryAuditLogger()

    def evaluate_deal(
        self,
        context: DealContext,
        approved_baseline: Optional[DealContext] = None,
        current_stage: Optional[ApprovalStage] = None
    ) -> GuardianEvaluationResult:
        """Run the comprehensive, deterministic Deal Guardian governance pipeline."""
        # 1. Normalize totals and margins
        context.recalculate_totals()
        current_approval_stage = current_stage or ApprovalStage(context.approval_state or "DRAFT")

        # 2. Check for Material Invalidation against Approved Baseline
        invalidation_res = self.material_detector.evaluate_invalidation(
            current_stage=current_approval_stage,
            approved_baseline=approved_baseline,
            proposed_state=context
        )

        if invalidation_res.approval_invalidated:
            current_approval_stage = ApprovalStage.INVALIDATED
            self.audit_logger.log_event(
                deal_id=context.deal_id,
                event_type="APPROVAL_INVALIDATED",
                actor_type="SYSTEM",
                actor_id="deal_guardian",
                before_state={"approval_stage": ApprovalStage.APPROVED.value},
                after_state={"approval_stage": ApprovalStage.INVALIDATED.value},
                reason="; ".join(invalidation_res.reasons)
            )

        # 3. Policy Resolution (GOV-01)
        policy_result = self.policy_resolver.resolve_policy(context)

        # 4. Fulfillment Planning (GOV-07)
        fulfillment_result = self.fulfillment_planner.plan_fulfillment(context)

        # 5. Blended Risk Calculation (GOV-02)
        risk_result = self.risk_calculator.calculate_risk(
            context=context,
            policy_result=policy_result,
            split_required=fulfillment_result.split_required
        )

        # 6. Approval Routing & State Machine (GOV-03)
        req_level = self.approval_router.determine_required_level(risk_result, policy_result)
        approval_required = req_level != RequiredApprovalLevel.NONE

        if current_approval_stage == ApprovalStage.INVALIDATED:
            # Re-enter pending approval workflow at the required level
            if req_level == RequiredApprovalLevel.FINANCE:
                current_approval_stage = ApprovalStage.PENDING_FINANCE
            elif req_level == RequiredApprovalLevel.MANAGER:
                current_approval_stage = ApprovalStage.PENDING_MANAGER
            else:
                current_approval_stage = ApprovalStage.AUTO_APPROVED

        elif current_approval_stage == ApprovalStage.DRAFT:
            if not approval_required:
                current_approval_stage = ApprovalStage.AUTO_APPROVED
            elif req_level == RequiredApprovalLevel.FINANCE:
                current_approval_stage = ApprovalStage.PENDING_FINANCE
            else:
                current_approval_stage = ApprovalStage.PENDING_MANAGER

        approval_summary = GuardianApprovalSummary(
            required=approval_required,
            level=req_level.value,
            current_stage=current_approval_stage,
            invalidated=invalidation_res.approval_invalidated,
            reasons=invalidation_res.reasons
        )

        # 7. Recommendations (GOV-06)
        recommendations = self.recommendation_scorer.generate_recommendations(context)

        # 8. Deal Health & Anomalies (GOV-08)
        health_result = self.health_calculator.calculate_health(
            context=context,
            risk_result=risk_result,
            has_backorder=fulfillment_result.total_backorder_qty > 0
        )

        # 9. Next Best Action Synthesis
        next_best_action = self._determine_next_best_action(
            context=context,
            risk=risk_result,
            approval=approval_summary,
            recommendations=recommendations,
            fulfillment=fulfillment_result,
            health=health_result
        )

        # 10. Narrative Explanation
        narrative = RiskExplainer.generate_narrative(risk_result)

        # 11. Log Audit Assessment
        self.audit_logger.log_event(
            deal_id=context.deal_id,
            event_type="DEAL_EVALUATED",
            actor_type="SYSTEM",
            actor_id="deal_guardian",
            before_state=None,
            after_state={
                "risk_score": risk_result.score,
                "approval_stage": current_approval_stage.value,
                "health_score": health_result.score
            },
            reason="Continuous Deal Guardian evaluation completed."
        )

        return GuardianEvaluationResult(
            deal_id=context.deal_id,
            risk=risk_result,
            approval=approval_summary,
            policy=policy_result,
            recommendations=recommendations,
            fulfillment=fulfillment_result,
            health=health_result,
            next_best_action=next_best_action,
            narrative_explanation=narrative,
            audit_events_count=len(getattr(self.audit_logger, "events", []))
        )

    def _determine_next_best_action(
        self,
        context: DealContext,
        risk: RiskAssessmentResult,
        approval: GuardianApprovalSummary,
        recommendations: RecommendationResult,
        fulfillment: FulfillmentPlanResult,
        health: DealHealthResult
    ) -> NextBestAction:
        """Deterministically prioritize the primary operational task."""
        # Case A: Re-approval required after customer counteroffer
        if approval.invalidated:
            return NextBestAction(
                type="RE_APPROVAL_REQUIRED",
                action_code="RE_APPROVAL_REQUIRED",
                priority="HIGH",
                title="Executive Re-Approval Required",
                description="Customer counteroffer modified approved terms; requires re-approval.",
                action_cta="Review Counteroffer",
                target_role="MANAGER"
            )

        # Case B: Finance Approval Required
        if approval.current_stage == ApprovalStage.PENDING_FINANCE:
            top_rec = recommendations.recommendations[0] if recommendations.recommendations else None
            rec_hint = f" Add {top_rec.product_name} (+₹{top_rec.margin_delta:,.0f} Margin) or request Finance approval." if top_rec else ""
            return NextBestAction(
                type="FINANCE_APPROVAL_REQUIRED",
                action_code="FINANCE_APPROVAL_REQUIRED",
                priority="HIGH",
                title="Finance Approval Required",
                description=f"Quote exceeds policy thresholds (Risk {risk.score}/100).{rec_hint}",
                action_cta="Submit for Finance Review",
                target_role="SALES_REP"
            )

        # Case C: Manager Approval Required
        if approval.current_stage == ApprovalStage.PENDING_MANAGER:
            return NextBestAction(
                type="MANAGER_APPROVAL_REQUIRED",
                action_code="MANAGER_APPROVAL_REQUIRED",
                priority="MEDIUM",
                title="Sales Manager Approval Required",
                description=f"Discount exceeds sales tier discretion (Risk {risk.score}/100).",
                action_cta="Submit to Manager",
                target_role="SALES_REP"
            )

        # Case D: Warehouse Split / Operational Constraint
        if fulfillment.split_required and not context.metadata.get("split_accepted", False):
            return NextBestAction(
                type="FULFILLMENT_SPLIT_REQUIRED",
                action_code="FULFILLMENT_SPLIT_REQUIRED",
                priority="MEDIUM",
                title="Review Warehouse Allocation Split",
                description="Stock is distributed across multiple facilities; confirm allocation.",
                action_cta="Accept Suggested Split",
                target_role="SALES_REP"
            )

        # Case E: Approved & Ready for Confirmation
        if approval.current_stage in (ApprovalStage.APPROVED, ApprovalStage.AUTO_APPROVED):
            return NextBestAction(
                type="CONFIRM_QUOTATION",
                action_code="CONFIRM_QUOTATION",
                priority="LOW",
                title="Ready for Order Confirmation",
                description="All commercial policies and stock requirements are satisfied.",
                action_cta="Confirm Order in Odoo",
                target_role="SALES_REP"
            )

        # Case F: Stalled Deal Warning
        if health.is_stalled:
            return NextBestAction(
                type="DEAL_STALLED_FOLLOW_UP",
                action_code="DEAL_STALLED_FOLLOW_UP",
                priority="MEDIUM",
                title="Follow Up Stalled Opportunity",
                description=f"Quotation has been inactive for {context.stalled_days} days; contact customer.",
                action_cta="Log Activity",
                target_role="SALES_REP"
            )

        # Case G: Recommend Margin Addition
        top_rec = recommendations.recommendations[0] if recommendations.recommendations else None
        if top_rec:
            return NextBestAction(
                type="ADD_RECOMMENDED_PRODUCT",
                action_code="ADD_RECOMMENDED_PRODUCT",
                priority="LOW",
                title=f"Add {top_rec.product_name}",
                description=f"{top_rec.reason} Projected margin increase: +₹{top_rec.margin_delta:,.0f}.",
                action_cta=f"Add {top_rec.product_name}",
                target_role="SALES_REP"
            )

        return NextBestAction(
            type="PROCEED",
            action_code="PROCEED",
            priority="LOW",
            title="Continue Quotation",
            description="Add products and configure terms.",
            action_cta="Save Draft",
            target_role="SALES_REP"
        )
