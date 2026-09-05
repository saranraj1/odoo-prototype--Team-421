# -*- coding: utf-8 -*-
"""
DealFlow360 — Repository Bridge
================================
Single integration glue between the Odoo module (dealflow_odoo) and the
PostgreSQL DealFlow360 Decision Engine repositories.

Doctrine
--------
* Odoo owns the transaction (sale.order, invoices, pickings).
* DealFlow owns decisions (risk, approvals, negotiations, fulfillment, governance).
* THIS bridge writes every Odoo-side governance event into the Decision Engine DB
  via the typed Repository layer — maintaining dual-write consistency.

Design Contract
---------------
* All public methods MUST NOT raise. DB failures are logged and swallowed so that
  an outage in the Decision Engine NEVER crashes an Odoo transaction.
* All public methods return a dict (success=True/False, id=<uuid or None>, error=<msg|None>).
* All SQL writes flow through the shared connection pool in db/connection.py.
* Uses the canonical DTOs from db/contracts.py and 12 repositories from repositories/.
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("dealflow.repository_bridge")

# ---------------------------------------------------------------------------
# Lazy repository & DTO imports
# ---------------------------------------------------------------------------

_REPOS_AVAILABLE = False
_DealRepository = None
_PolicyRepository = None
_RiskRepository = None
_ApprovalRepository = None
_NegotiationRepository = None
_FulfillmentRepository = None
_HealthRepository = None
_AuditRepository = None
_RecommendationRepository = None
_SubscriptionEventRepository = None
_WarehouseConfigRepository = None
_UpsellRuleRepository = None
_UserRepository = None

_DealDTO = None
_RiskAssessmentDTO = None
_RiskFactorDTO = None
_ApprovalRequestDTO = None
_ApprovalActionDTO = None
_NegotiationRequestDTO = None
_NegotiationChangeDTO = None
_FulfillmentPlanDTO = None
_FulfillmentPlanLineDTO = None
_RecommendationDTO = None
_DealHealthSnapshotDTO = None
_AuditEventDTO = None
_UpsellRuleDTO = None
_SubscriptionEventDTO = None
_WarehouseConfigDTO = None
_DiscountPolicyDTO = None
_UserDTO = None


def _try_load_repositories() -> bool:
    """Attempt to import the repository layer and DTOs.

    Prepends the workspace root to sys.path so sibling db/ and repositories/
    packages are importable from inside an Odoo worker process.
    """
    global _REPOS_AVAILABLE
    global _DealRepository, _PolicyRepository, _RiskRepository
    global _ApprovalRepository, _NegotiationRepository, _FulfillmentRepository
    global _HealthRepository, _AuditRepository, _RecommendationRepository
    global _SubscriptionEventRepository, _WarehouseConfigRepository, _UpsellRuleRepository, _UserRepository
    global _DealDTO, _RiskAssessmentDTO, _RiskFactorDTO, _ApprovalRequestDTO, _ApprovalActionDTO
    global _NegotiationRequestDTO, _NegotiationChangeDTO, _FulfillmentPlanDTO, _FulfillmentPlanLineDTO
    global _RecommendationDTO, _DealHealthSnapshotDTO, _AuditEventDTO, _UpsellRuleDTO
    global _SubscriptionEventDTO, _WarehouseConfigDTO, _DiscountPolicyDTO, _UserDTO

    if _REPOS_AVAILABLE:
        return True

    try:
        this_dir = os.path.dirname(os.path.abspath(__file__))          # services/
        addon_dir = os.path.dirname(this_dir)                           # dealflow_odoo/
        module_root = os.path.dirname(addon_dir)                        # dealflow_odoo-main/
        workspace_root = os.path.dirname(module_root)                   # workspace root
        env_override = os.getenv("DEALFLOW_WORKSPACE_ROOT")
        if env_override and os.path.isdir(env_override):
            workspace_root = env_override

        if workspace_root not in sys.path:
            sys.path.insert(0, workspace_root)

        from repositories import (
            ApprovalRepository,
            AuditRepository,
            DealRepository,
            FulfillmentRepository,
            HealthRepository,
            NegotiationRepository,
            PolicyRepository,
            RecommendationRepository,
            RiskRepository,
            SubscriptionEventRepository,
            UpsellRuleRepository,
            WarehouseConfigRepository,
            UserRepository,
        )
        from db.contracts import (
            DealDTO,
            RiskAssessmentDTO,
            RiskFactorDTO,
            ApprovalRequestDTO,
            ApprovalActionDTO,
            NegotiationRequestDTO,
            NegotiationChangeDTO,
            FulfillmentPlanDTO,
            FulfillmentPlanLineDTO,
            RecommendationDTO,
            DealHealthSnapshotDTO,
            AuditEventDTO,
            UpsellRuleDTO,
            SubscriptionEventDTO,
            WarehouseConfigDTO,
            DiscountPolicyDTO,
            UserDTO,
        )

        _DealRepository = DealRepository
        _PolicyRepository = PolicyRepository
        _RiskRepository = RiskRepository
        _ApprovalRepository = ApprovalRepository
        _NegotiationRepository = NegotiationRepository
        _FulfillmentRepository = FulfillmentRepository
        _HealthRepository = HealthRepository
        _AuditRepository = AuditRepository
        _RecommendationRepository = RecommendationRepository
        _SubscriptionEventRepository = SubscriptionEventRepository
        _WarehouseConfigRepository = WarehouseConfigRepository
        _UpsellRuleRepository = UpsellRuleRepository
        _UserRepository = UserRepository

        _DealDTO = DealDTO
        _RiskAssessmentDTO = RiskAssessmentDTO
        _RiskFactorDTO = RiskFactorDTO
        _ApprovalRequestDTO = ApprovalRequestDTO
        _ApprovalActionDTO = ApprovalActionDTO
        _NegotiationRequestDTO = NegotiationRequestDTO
        _NegotiationChangeDTO = NegotiationChangeDTO
        _FulfillmentPlanDTO = FulfillmentPlanDTO
        _FulfillmentPlanLineDTO = FulfillmentPlanLineDTO
        _RecommendationDTO = RecommendationDTO
        _DealHealthSnapshotDTO = DealHealthSnapshotDTO
        _AuditEventDTO = AuditEventDTO
        _UpsellRuleDTO = UpsellRuleDTO
        _SubscriptionEventDTO = SubscriptionEventDTO
        _WarehouseConfigDTO = WarehouseConfigDTO
        _DiscountPolicyDTO = DiscountPolicyDTO
        _UserDTO = UserDTO

        _REPOS_AVAILABLE = True
        logger.info("[DealFlowBridge] Repository & DTO layer loaded successfully from '%s'.", workspace_root)
        return True

    except Exception as exc:
        logger.warning("[DealFlowBridge] Repository layer unavailable (Odoo standalone mode): %s", exc)
        return False


# ---------------------------------------------------------------------------
# Bridge Class
# ---------------------------------------------------------------------------

class DealFlowRepositoryBridge:
    """Glue class that translates Odoo lifecycle events into PostgreSQL writes."""

    def __init__(self) -> None:
        self._enabled = _try_load_repositories() and (
            os.getenv("DEALFLOW_DB_ENABLED", "true").lower() not in ("0", "false", "no")
        )
        if self._enabled:
            self._init_repo_instances()

    def _init_repo_instances(self) -> None:
        """Instantiate all 12 repositories using shared connection pooling."""
        self._deal_repo = _DealRepository()
        self._policy_repo = _PolicyRepository()
        self._risk_repo = _RiskRepository()
        self._approval_repo = _ApprovalRepository()
        self._negotiation_repo = _NegotiationRepository()
        self._fulfillment_repo = _FulfillmentRepository()
        self._health_repo = _HealthRepository()
        self._audit_repo = _AuditRepository()
        self._recommendation_repo = _RecommendationRepository()
        self._subscription_repo = _SubscriptionEventRepository()
        self._warehouse_repo = _WarehouseConfigRepository()
        self._upsell_repo = _UpsellRuleRepository()
        self._user_repo = _UserRepository()

    @property
    def is_enabled(self) -> bool:
        """True when the DB layer is available and DEALFLOW_DB_ENABLED=true."""
        return self._enabled

    def _safe(self, operation: str, fn, *args, **kwargs) -> Dict[str, Any]:
        """Execute *fn* and return a result dict; swallow all exceptions."""
        if not self._enabled:
            return {"success": False, "id": None, "error": "DB bridge disabled"}
        try:
            result = fn(*args, **kwargs)
            if isinstance(result, str):
                return {"success": True, "id": result, "error": None}
            if isinstance(result, (list, dict)):
                return {"success": True, "id": None, "result": result, "error": None}
            if hasattr(result, "id"):
                return {"success": True, "id": str(result.id), "error": None}
            return {"success": True, "id": None, "error": None}
        except Exception as exc:
            logger.error("[DealFlowBridge] %s failed: %s", operation, exc, exc_info=True)
            return {"success": False, "id": None, "error": str(exc)}

    # -----------------------------------------------------------------------
    # 1. Deal Sync
    # -----------------------------------------------------------------------

    def sync_deal_from_odoo(
        self,
        order_dict: Dict[str, Any],
        customer_tier: str = "STANDARD",
        owner_user_id: Optional[int] = None,
        company_id: int = 1,
    ) -> Dict[str, Any]:
        """Upsert a DealFlow deal row from an Odoo order dictionary."""
        def _write():
            order_id = int(order_dict["id"])
            partner_id = int(order_dict.get("partner_id") or 1)
            owner_id = int(owner_user_id or order_dict.get("owner_user_id") or 1)
            
            existing = self._deal_repo.get_by_odoo_order_id(order_id)
            if existing:
                deal_id = existing.id
            else:
                deal = self._deal_repo.create_deal(
                    odoo_sale_order_id=order_id,
                    odoo_partner_id=partner_id,
                    owner_user_id=owner_id,
                    company_id=company_id,
                )
                deal_id = deal.id

            raw_status = str(order_dict.get("state", "draft")).lower()
            if raw_status in ("draft", "sent"):
                deal_status = "DRAFT"
            elif raw_status == "sale":
                deal_status = "APPROVED"
            elif raw_status == "done":
                deal_status = "CLOSED"
            elif raw_status == "cancel":
                deal_status = "CLOSED"
            elif raw_status.upper() in ("DRAFT", "EVALUATED", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "REAPPROVAL", "READY", "FULFILLING", "BILLING", "CLOSED"):
                deal_status = raw_status.upper()
            else:
                deal_status = "DRAFT"

            raw_approval = str(order_dict.get("dealflow_approval_state", "NONE")).lower()
            if raw_approval in ("none", "draft"):
                approval_state = "NONE"
            elif raw_approval in ("pending_approval", "pending_l1", "pending_manager"):
                approval_state = "PENDING_MANAGER"
            elif raw_approval in ("pending_l2", "pending_finance"):
                approval_state = "PENDING_FINANCE"
            elif raw_approval == "approved":
                approval_state = "APPROVED"
            elif raw_approval == "rejected":
                approval_state = "REJECTED"
            elif raw_approval in ("reapproval_required", "returned"):
                approval_state = "RETURNED"
            elif raw_approval.upper() in ("NONE", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED", "RETURNED"):
                approval_state = raw_approval.upper()
            else:
                approval_state = "NONE"

            risk_score = min(100.0, max(0.0, float(order_dict.get("dealflow_risk_score") or 0.0)))
            raw_health = str(order_dict.get("dealflow_health_status", "HEALTHY")).upper()
            health_status = raw_health if raw_health in ("HEALTHY", "STALLED", "AT_RISK", "CRITICAL") else "HEALTHY"

            self._deal_repo.update_status(deal_id, deal_status, approval_state, risk_score)
            self._deal_repo.update_health(deal_id, health_status)
            return deal_id

        return self._safe("sync_deal_from_odoo", _write)

    def update_deal_status(
        self,
        deal_id: str,
        status: str,
        approval_state: str,
        risk_score: float,
    ) -> Dict[str, Any]:
        """Push a status update for an existing deal record."""
        valid_statuses = ("DRAFT", "EVALUATED", "PENDING_APPROVAL", "APPROVED", "NEGOTIATION", "REAPPROVAL", "READY", "FULFILLING", "BILLING", "CLOSED")
        clean_status = status.upper() if status.upper() in valid_statuses else "DRAFT"

        raw_approval = approval_state.lower()
        if raw_approval in ("none", "draft"):
            clean_approval = "NONE"
        elif raw_approval in ("pending_approval", "pending_l1", "pending_manager"):
            clean_approval = "PENDING_MANAGER"
        elif raw_approval in ("pending_l2", "pending_finance"):
            clean_approval = "PENDING_FINANCE"
        elif raw_approval == "approved":
            clean_approval = "APPROVED"
        elif raw_approval == "rejected":
            clean_approval = "REJECTED"
        elif raw_approval in ("reapproval_required", "returned"):
            clean_approval = "RETURNED"
        elif raw_approval.upper() in ("NONE", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED", "RETURNED"):
            clean_approval = raw_approval.upper()
        else:
            clean_approval = "NONE"

        clean_risk = min(100.0, max(0.0, float(risk_score)))
        return self._safe(
            "update_deal_status",
            self._deal_repo.update_status,
            deal_id, clean_status, clean_approval, clean_risk,
        )

    # -----------------------------------------------------------------------
    # 2. Risk Assessment
    # -----------------------------------------------------------------------

    def record_risk_assessment(
        self,
        deal_id: str,
        risk_dict: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Write a risk assessment + explainable factor rows."""
        def _write():
            factors = []
            for f in risk_dict.get("factors", []):
                factors.append(
                    _RiskFactorDTO(
                        factor_type=f.get("factor_type", f.get("type", "DISCOUNT_SEVERITY")),
                        raw_value=float(f.get("raw_value", 0.0)),
                        weight=float(f.get("weight", 1.0)),
                        contribution=float(f.get("contribution", 0.0)),
                        reason=f.get("reason", "Risk rule triggered"),
                        source_reference=f.get("source_reference"),
                    )
                )

            assessment = _RiskAssessmentDTO(
                deal_id=deal_id,
                risk_score=float(risk_dict.get("risk_score", 0.0)),
                severity=str(risk_dict.get("severity", "LOW")).upper(),
                decision=str(risk_dict.get("decision", "AUTO_APPROVED")).upper(),
                factors=factors,
                trigger_type=risk_dict.get("trigger_type", "SYSTEM_EVALUATION"),
                policy_version=risk_dict.get("policy_version", "v1.0"),
            )
            return self._risk_repo.save_assessment(assessment)

        return self._safe("record_risk_assessment", _write)

    # -----------------------------------------------------------------------
    # 3. Approval Workflows
    # -----------------------------------------------------------------------

    def create_approval_chain(
        self,
        deal_id: str,
        assessment_id: str,
        levels: List[str],
    ) -> Dict[str, Any]:
        """Create sequential approval requests for a deal."""
        def _write():
            return self._approval_repo.create_chain(deal_id, assessment_id, levels)

        return self._safe("create_approval_chain", _write)

    def record_approval_action(
        self,
        request_id: str,
        action: str,
        actor_user_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record an approval, rejection, or return action."""
        def _write():
            return self._approval_repo.record_action(
                request_id=request_id,
                actor_user_id=actor_user_id,
                action=action.upper(),
                reason=reason,
            )

        return self._safe("record_approval_action", _write)

    # -----------------------------------------------------------------------
    # 4. Customer Negotiation
    # -----------------------------------------------------------------------

    def record_negotiation(
        self,
        deal_id: str,
        odoo_sale_order_id: Optional[int] = None,
        customer_party_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        total_counter_discount: float = 0.0,
        negotiation_dict: Optional[Dict[str, Any]] = None,
        lines: Optional[List[Dict[str, Any]]] = None,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist a customer counter-offer negotiation request and changes."""
        def _write():
            c_id = customer_party_id or customer_id or 1
            so_id = odoo_sale_order_id or 1
            if negotiation_dict:
                disc = float(negotiation_dict.get("requested_discount", total_counter_discount))
                n_note = negotiation_dict.get("customer_note", note)
                n_lines = negotiation_dict.get("line_changes", lines or [])
            else:
                disc = total_counter_discount
                n_note = note
                n_lines = lines or []

            return self._negotiation_repo.stage_counter_offer(
                deal_id=deal_id,
                odoo_sale_order_id=so_id,
                customer_party_id=c_id,
                total_counter_discount=disc,
                lines=n_lines,
                note=n_note,
            )

        return self._safe("record_negotiation", _write)

    # -----------------------------------------------------------------------
    # 5. Fulfillment Plans
    # -----------------------------------------------------------------------

    def record_fulfillment_plan(
        self,
        deal_id: str,
        odoo_sale_order_id: Optional[int] = None,
        plan: Optional[Any] = None,
        status: str = "PROPOSED",
        allocations: Optional[List[Dict[str, Any]]] = None,
        estimated_shipments: int = 1,
        estimated_shipping_cost: float = 0.0,
    ) -> Dict[str, Any]:
        """Persist multi-warehouse fulfillment plan and split allocation lines."""
        def _write():
            nonlocal odoo_sale_order_id, status, allocations, estimated_shipments, estimated_shipping_cost
            if plan is not None:
                p_dict = asdict(plan) if is_dataclass(plan) else (dict(plan) if isinstance(plan, dict) else {})
                odoo_sale_order_id = odoo_sale_order_id or p_dict.get("order_id", p_dict.get("odoo_sale_order_id", 1))
                status = p_dict.get("status", status)
                allocations = p_dict.get("allocations", allocations or [])
                estimated_shipments = p_dict.get("estimated_shipments", estimated_shipments)
                estimated_shipping_cost = p_dict.get("estimated_shipping_cost", estimated_shipping_cost)

            lines = []
            for alloc in (allocations or []):
                alloc_dict = asdict(alloc) if is_dataclass(alloc) else dict(alloc)
                lines.append(
                    _FulfillmentPlanLineDTO(
                        odoo_product_id=int(alloc_dict.get("product_id", alloc_dict.get("odoo_product_id", 1))),
                        odoo_warehouse_id=int(alloc_dict.get("warehouse_id", alloc_dict.get("odoo_warehouse_id", 1))),
                        requested_qty=float(alloc_dict.get("requested_qty", alloc_dict.get("quantity", 0.0))),
                        allocated_qty=float(alloc_dict.get("allocated_qty", alloc_dict.get("quantity", 0.0))),
                        backorder_qty=float(alloc_dict.get("backorder_qty", 0.0)),
                        shipping_cost=float(alloc_dict.get("shipping_cost", 0.0)),
                    )
                )

            plan_dto = _FulfillmentPlanDTO(
                deal_id=deal_id,
                odoo_sale_order_id=int(odoo_sale_order_id or 1),
                status=status.upper(),
                estimated_shipments=estimated_shipments,
                estimated_shipping_cost=estimated_shipping_cost,
                lines=lines,
            )
            return self._fulfillment_repo.save_plan(plan_dto)

        return self._safe("record_fulfillment_plan", _write)

    # -----------------------------------------------------------------------
    # 6. Subscription Events & Proration
    # -----------------------------------------------------------------------

    def record_subscription_event(
        self,
        deal_id: str,
        odoo_subscription_id: int,
        event_type: str,
        old_plan: Optional[str] = None,
        new_plan: Optional[str] = None,
        old_quantity: Optional[int] = None,
        new_quantity: Optional[int] = None,
        billing_cycle: Optional[str] = None,
        prorated_amount: Optional[float] = None,
        credit_note_amount: float = 0.0,
        odoo_credit_note_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Write a subscription lifecycle, proration, or credit note event."""
        def _write():
            event_dto = _SubscriptionEventDTO(
                deal_id=deal_id,
                odoo_subscription_id=odoo_subscription_id,
                event_type=event_type.upper(),
                old_plan=old_plan,
                new_plan=new_plan,
                old_quantity=old_quantity,
                new_quantity=new_quantity,
                billing_cycle=billing_cycle.upper() if billing_cycle else None,
                prorated_amount=prorated_amount,
                credit_note_amount=credit_note_amount,
                odoo_credit_note_id=odoo_credit_note_id,
                reason=reason,
            )
            return self._subscription_repo.record_event(event_dto)

        return self._safe("record_subscription_event", _write)

    # -----------------------------------------------------------------------
    # 7. Recommendations / Upsells
    # -----------------------------------------------------------------------

    def save_recommendations(
        self,
        deal_id: str,
        recommendations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Batch-persist recommendation rows for a deal."""
        def _write():
            recs_dto = []
            for r in recommendations:
                recs_dto.append(
                    _RecommendationDTO(
                        deal_id=deal_id,
                        odoo_product_id=int(r.get("product_id", r.get("odoo_product_id", 1))),
                        recommendation_type=r.get("type", r.get("recommendation_type", "UPSELL")).upper(),
                        score=float(r.get("score", 1.0)),
                        margin_delta=float(r.get("margin_delta", 0.0)),
                        reason=r.get("reason", "Co-purchase history"),
                        source=r.get("source", "CO_PURCHASE"),
                        status=r.get("status", "ACTIVE").upper(),
                    )
                )
            return self._recommendation_repo.save_recommendations(deal_id, recs_dto)

        return self._safe("save_recommendations", _write)

    # -----------------------------------------------------------------------
    # 8. Deal Health Snapshots
    # -----------------------------------------------------------------------

    def record_health_snapshot(
        self,
        deal_id: str,
        health_status: str,
        overall_score: float,
        stalled_score: float = 0.0,
        discount_anomaly_score: float = 0.0,
        delivery_risk_score: float = 0.0,
        approval_delay_score: float = 0.0,
    ) -> Dict[str, Any]:
        """Write a point-in-time deal health snapshot."""
        def _write():
            snapshot = _DealHealthSnapshotDTO(
                deal_id=deal_id,
                health_status=health_status.upper(),
                overall_score=float(overall_score),
                stalled_score=float(stalled_score),
                discount_anomaly_score=float(discount_anomaly_score),
                delivery_risk_score=float(delivery_risk_score),
                approval_delay_score=float(approval_delay_score),
            )
            return self._health_repo.record_snapshot(snapshot)

        return self._safe("record_health_snapshot", _write)

    # -----------------------------------------------------------------------
    # 9. Audit Trail
    # -----------------------------------------------------------------------

    def append_audit_event(
        self,
        operation: str,
        deal_id: Optional[str],
        actor: str,
        actor_id: Optional[int],
        result: str,
        record_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        failure_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Write a persistent audit event to the Decision Engine DB."""
        def _write():
            effective_deal_id = deal_id or "00000000-0000-0000-0000-000000000000"
            if record_id:
                try:
                    target_entity_id = str(uuid.UUID(str(record_id)))
                except (ValueError, TypeError):
                    target_entity_id = str(uuid.uuid5(uuid.NAMESPACE_OID, str(record_id)))
            else:
                target_entity_id = effective_deal_id

            payload = {
                "operation": operation,
                "actor_name": actor,
                "result": result,
                "failure_reason": failure_reason,
                **(details or {}),
            }
            return self._audit_repo.log_event(
                deal_id=effective_deal_id,
                event_type=operation,
                entity_type="sale.order",
                entity_id=target_entity_id,
                actor_type="USER" if actor_id else "SYSTEM",
                actor_id=actor_id or 1,
                reason=failure_reason,
                metadata=payload,
            )

        return self._safe("append_audit_event", _write)

    # -----------------------------------------------------------------------
    # 10. Policy, Warehouse, and Upsell Queries
    # -----------------------------------------------------------------------

    def get_effective_discount_policy(
        self,
        customer_tier: str,
        category_id: Optional[int] = None,
        company_id: int = 1,
    ) -> Optional[Any]:
        """Fetch active discount policy for customer tier and category."""
        if not self._enabled:
            return None
        try:
            return self._policy_repo.get_effective_policy(customer_tier, category_id, company_id)
        except Exception as exc:
            logger.warning("[DealFlowBridge] get_effective_policy failed: %s", exc)
            return None

    def get_active_warehouses(self, company_id: int = 1) -> List[Any]:
        """Fetch active warehouse configuration with shipping cost weights."""
        if not self._enabled:
            return []
        try:
            return self._warehouse_repo.list_active(company_id)
        except Exception as exc:
            logger.warning("[DealFlowBridge] get_active_warehouses failed: %s", exc)
            return []

    def get_cart_upsell_suggestions(
        self,
        product_ids: List[int],
        company_id: int = 1,
    ) -> List[Any]:
        """Fetch active upsell/cross-sell rules for items currently in cart."""
        if not self._enabled:
            return []
        try:
            return self._upsell_repo.get_all_for_cart(product_ids, company_id)
        except Exception as exc:
            logger.warning("[DealFlowBridge] get_cart_upsell_suggestions failed: %s", exc)
            return []

    # -----------------------------------------------------------------------
    # 11. User Management & Permission Matrix (PS Section 4 & 6.1)
    # -----------------------------------------------------------------------

    def sync_user_from_odoo(
        self,
        user_dict: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Dual-write an Odoo user with assigned role into PostgreSQL app_user table."""
        def _write():
            odoo_user_id = int(user_dict["odoo_user_id"])
            name = str(user_dict.get("name", f"User {odoo_user_id}"))
            email = str(user_dict.get("email", f"user{odoo_user_id}@dealflow.internal"))
            role = str(user_dict.get("role", "REP")).upper()
            can_approve_l1 = bool(user_dict.get("can_approve_level1", False))
            can_approve_l2 = bool(user_dict.get("can_approve_level2", False))
            has_portal = bool(user_dict.get("has_portal_access", False))
            company_id = int(user_dict.get("company_id", 1))

            user = self._user_repo.create_user(
                odoo_user_id=odoo_user_id,
                name=name,
                email=email,
                role=role,
                can_approve_level1=can_approve_l1,
                can_approve_level2=can_approve_l2,
                has_portal_access=has_portal,
                company_id=company_id,
            )
            return user.id

        return self._safe("sync_user_from_odoo", _write)

    def get_user_by_odoo_id(self, odoo_user_id: int) -> Optional[Any]:
        """Fetch user record from PostgreSQL by Odoo UID."""
        if not self._enabled:
            return None
        try:
            return self._user_repo.get_by_odoo_id(odoo_user_id)
        except Exception as exc:
            logger.warning("[DealFlowBridge] get_user_by_odoo_id failed: %s", exc)
            return None

    def list_approvers(self, level: int = 1) -> List[Any]:
        """Fetch qualified approver users from PostgreSQL for a given approval level."""
        if not self._enabled:
            return []
        try:
            return self._user_repo.list_approvers_for_level(level)
        except Exception as exc:
            logger.warning("[DealFlowBridge] list_approvers failed: %s", exc)
            return []

    def sync_user(
        self,
        odoo_user_id: int,
        name: str,
        email: str,
        role: str = "REP",
        can_approve_level1: bool = False,
        can_approve_level2: bool = False,
        has_portal_access: bool = False,
        company_id: int = 1,
    ) -> Dict[str, Any]:
        """Convenience method to dual-write an Odoo user with assigned role into PostgreSQL."""
        return self.sync_user_from_odoo({
            "odoo_user_id": odoo_user_id,
            "name": name,
            "email": email,
            "role": role,
            "can_approve_level1": can_approve_level1,
            "can_approve_level2": can_approve_level2,
            "has_portal_access": has_portal_access,
            "company_id": company_id,
        })

    def record_audit_event(
        self,
        entity_type: str,
        entity_id: str,
        event_type: str,
        actor_user_id: Optional[int] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Alias for append_audit_event with simplified parameters."""
        return self.append_audit_event(
            operation=event_type,
            deal_id=entity_id if entity_type == "DEAL" else None,
            actor="user",
            actor_id=actor_user_id,
            result="SUCCESS",
            details=payload,
        )


