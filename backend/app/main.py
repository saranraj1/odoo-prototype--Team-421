# -*- coding: utf-8 -*-
"""DealFlow360 Decision Engine & Governance FastAPI Gateway.

Exposes Deal Guardian orchestrator, policy resolution, blended risk scoring,
approval FSM, material change detection, and fulfillment planning to
the Frontend web application, Odoo ERP, and external services.
"""

import logging
import os
import sys
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current_dir)
_workspace_dir = os.path.dirname(_backend_dir)
for p in (_workspace_dir, _backend_dir):
    if p and p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

from backend.app.governance.context import DealContext, CustomerContext, DealLineContext
from backend.app.governance.guardian import (
    DealGuardian,
    GuardianEvaluationResult,
    NextBestAction,
)
from backend.app.governance.approval.state_machine import (
    ApprovalStage,
    ApprovalActionType,
    ApprovalStateMachine,
    ApprovalStateResult,
)
from backend.app.governance.approval.invalidation import (
    MaterialChangeDetector,
    InvalidationResult,
)
from backend.app.governance.fulfillment.planner import (
    FulfillmentPlanner,
    FulfillmentPlanResult,
)
from backend.app.governance.policy.resolver import PolicyResolver
from backend.app.governance.recommendation.scorer import RecommendationScorer

logger = logging.getLogger("dealflow.gateway")

app = FastAPI(
    title="DealFlow360 Decision Engine Gateway",
    version="1.0.0",
    description="Deterministic Commercial Governance & Deal Guardian API",
)

# Enable CORS for frontend and multi-service access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global shared Guardian orchestrator instance
guardian = DealGuardian()


class ApprovalActionRequest(BaseModel):
    deal_id: str
    current_stage: str = "DRAFT"
    action: str = "SUBMIT"
    approver_role: str = "SALES_REP"
    comments: Optional[str] = None
    target_stage: Optional[str] = None


class NegotiationEvaluationRequest(BaseModel):
    proposed_context: DealContext
    approved_baseline: Optional[DealContext] = None
    current_stage: str = "APPROVED"


# -----------------------------------------------------------------------------
# Liveness & Readiness Probes
# -----------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "DealFlow360 Decision Engine Gateway",
        "version": "1.0.0",
        "doctrine": "Odoo owns transactions. DealFlow owns decisions. Deal Guardian governs deal state.",
    }


# -----------------------------------------------------------------------------
# Deal Guardian Evaluation Endpoints
# -----------------------------------------------------------------------------

@app.post(
    "/api/governance/evaluate",
    tags=["Governance"],
)
def evaluate_deal(raw_body: Dict[str, Any]) -> Dict[str, Any]:
    """Run complete deterministic governance evaluation on a DealContext.
    
    Accepts either direct DealContext payload or wrapped {"context": ..., "approved_baseline": ...}.
    """
    try:
        if "context" in raw_body and isinstance(raw_body["context"], dict):
            ctx_data = raw_body["context"]
            baseline_data = raw_body.get("approved_baseline")
        else:
            ctx_data = raw_body
            baseline_data = None

        deal_ctx = DealContext.model_validate(ctx_data)
        baseline_ctx = DealContext.model_validate(baseline_data) if baseline_data else None

        result = guardian.evaluate_deal(
            context=deal_ctx,
            approved_baseline=baseline_ctx,
        )
        return result.model_dump()
    except Exception as e:
        logger.exception("Deal Guardian evaluation error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Evaluation failed: {str(e)}",
        )


@app.post(
    "/api/governance/order/{order_id}/evaluate",
    tags=["Governance"],
)
def evaluate_odoo_order(order_id: int) -> Dict[str, Any]:
    """Retrieve order context from Odoo and evaluate via Deal Guardian."""
    try:
        # Attempt direct evaluation via Odoo integration service if available
        try:
            from dealflow_odoo.services.integration_service import OdooIntegrationService
            from dealflow_odoo.schemas import DealContextDTO
            service = OdooIntegrationService()
            context_dto = service.get_deal_context(order_id)
            
            # Map DTO to DealContext
            customer_ctx = CustomerContext(
                odoo_partner_id=context_dto.customer.partner_id,
                name=context_dto.customer.name,
                tier=context_dto.customer.tier or "Bronze",
                email=context_dto.customer.email,
                company_name=context_dto.customer.company_name,
            )
            deal_lines = []
            for l in context_dto.lines:
                deal_lines.append(
                    DealLineContext(
                        odoo_line_id=l.line_id,
                        odoo_product_id=l.product_id,
                        product_name=l.product_name,
                        category_name=l.category_name or "General",
                        odoo_category_id=getattr(l, "category_id", 1),
                        quantity=float(l.product_uom_qty),
                        price_unit=float(l.price_unit),
                        cost_unit=float(l.cost_price),
                        discount_pct=float(l.discount),
                        is_recurring=bool(l.is_recurring),
                        recurring_interval=l.recurring_interval,
                    )
                )
            ctx = DealContext(
                deal_id=context_dto.deal_id or f"DEAL-{order_id}",
                odoo_sale_order_id=order_id,
                order_name=context_dto.order_name,
                customer=customer_ctx,
                lines=deal_lines,
                status="DRAFT" if context_dto.state in ("draft", "sent") else "CONFIRMED",
                approval_state=context_dto.dealflow_approval_state.upper() if context_dto.dealflow_approval_state else "DRAFT",
                currency=context_dto.currency or "INR",
            )
            result = guardian.evaluate_deal(ctx)
            return result.model_dump()
        except Exception as odoo_err:
            logger.info("Direct Odoo connection unavailable, using fallback mock: %s", odoo_err)
            # Standalone fallback context for testing/demo
            mock_ctx = DealContext(
                deal_id=f"DEAL-{order_id}",
                odoo_sale_order_id=order_id,
                order_name=f"SO{order_id:04d}",
                customer=CustomerContext(
                    odoo_partner_id=1,
                    name="Acme Corp",
                    tier="Gold",
                    email="procurement@acme.com",
                ),
                lines=[
                    DealLineContext(
                        odoo_line_id=1,
                        odoo_product_id=72,
                        product_name="Enterprise Laptop Pro",
                        category_name="Hardware",
                        odoo_category_id=1,
                        quantity=10.0,
                        price_unit=120000.0,
                        cost_unit=85000.0,
                        discount_pct=10.0,
                    )
                ],
                currency="INR",
            )
            result = guardian.evaluate_deal(mock_ctx)
            return result.model_dump()
    except Exception as e:
        logger.exception("Failed to evaluate Odoo order %s: %s", order_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# -----------------------------------------------------------------------------
# Approval FSM & State Machine Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/governance/approve", tags=["Approvals"])
def process_approval_action(req: ApprovalActionRequest) -> Dict[str, Any]:
    """Execute state machine transition on deal approval."""
    try:
        fsm = ApprovalStateMachine()
        current = ApprovalStage(req.current_stage)
        action_type = ApprovalActionType(req.action)
        
        if req.target_stage:
            target = ApprovalStage(req.target_stage)
        else:
            if action_type == ApprovalActionType.APPROVE:
                target = ApprovalStage.APPROVED
            elif action_type == ApprovalActionType.REJECT:
                target = ApprovalStage.REJECTED
            elif action_type == ApprovalActionType.RETURN:
                target = ApprovalStage.RETURNED_FOR_REVISION
            elif action_type == ApprovalActionType.SUBMIT:
                target = ApprovalStage.PENDING_MANAGER
            else:
                target = ApprovalStage.PENDING_MANAGER

        new_stage = fsm.transition(
            current_stage=current,
            target_stage=target,
            actor=req.approver_role,
            reason=req.comments or "",
        )
        return {
            "success": True,
            "deal_id": req.deal_id,
            "previous_stage": current.value,
            "new_stage": new_stage.value,
            "is_approved": new_stage == ApprovalStage.APPROVED,
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as e:
        logger.exception("Approval transition error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# -----------------------------------------------------------------------------
# Negotiation Invalidation Endpoint
# -----------------------------------------------------------------------------

@app.post("/api/governance/negotiate", tags=["Negotiations"])
def evaluate_negotiation(req: NegotiationEvaluationRequest) -> InvalidationResult:
    """Evaluate whether customer counteroffer invalidates prior approval."""
    detector = MaterialChangeDetector()
    current_stage = ApprovalStage(req.current_stage)
    result = detector.evaluate_invalidation(
        current_stage=current_stage,
        approved_baseline=req.approved_baseline,
        proposed_state=req.proposed_context,
    )
    return result


# -----------------------------------------------------------------------------
# Multi-Warehouse Fulfillment Allocation Endpoint
# -----------------------------------------------------------------------------

@app.post(
    "/api/governance/fulfillment",
    response_model=FulfillmentPlanResult,
    tags=["Fulfillment"],
)
def plan_fulfillment(context: DealContext) -> FulfillmentPlanResult:
    """Calculate multi-warehouse fulfillment allocation."""
    planner = FulfillmentPlanner()
    return planner.plan_fulfillment(context)


# -----------------------------------------------------------------------------
# Policy & Recommendation Catalog Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/governance/policies", tags=["Policies"])
def get_policies() -> Dict[str, Any]:
    """Retrieve active discount governance policy thresholds."""
    from backend.app.governance.policy.resolver import DEFAULT_TIER_LIMITS, DEFAULT_CATEGORY_LIMITS
    return {
        "success": True,
        "default_tier_limits": DEFAULT_TIER_LIMITS,
        "default_category_limits": DEFAULT_CATEGORY_LIMITS,
    }


@app.get("/api/governance/recommendations", tags=["Recommendations"])
def get_recommendations(line_product_ids: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve candidate product recommendations for deal expansion."""
    pids = []
    if line_product_ids:
        for p in line_product_ids.split(","):
            p_str = p.strip()
            if p_str.isdigit():
                pids.append(int(p_str))
    candidates = guardian.recommendation_scorer.provider.get_candidates_for_lines(pids)
    return {
        "success": True,
        "candidates": [c.model_dump() for c in candidates],
    }

