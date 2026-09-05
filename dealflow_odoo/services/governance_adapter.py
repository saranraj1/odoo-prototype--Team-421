# -*- coding: utf-8 -*-
"""DealFlow360 — Governance Adapter.

Bridges Odoo ERP transactions (Person 2) with the Deal Guardian Decision Engine (Person 3).
Converts Odoo DealContextDTO into canonical DealContext, executes deterministic
governance evaluation, updates Odoo sales order fields, and dual-writes decisions
to PostgreSQL repositories via DealFlowRepositoryBridge (Person 1).
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, Dict, Optional, List

logger = logging.getLogger("dealflow.governance_adapter")

# Ensure repository and backend packages are reachable
this_dir = os.path.dirname(os.path.abspath(__file__))
addon_dir = os.path.dirname(this_dir)
module_root = os.path.dirname(addon_dir)
workspace_root = os.path.dirname(module_root)
for p in (module_root, workspace_root):
    if p and p not in sys.path and os.path.isdir(p):
        sys.path.insert(0, p)

try:
    from backend.app.governance.context import (
        DealContext,
        CustomerContext,
        DealLineContext,
        DealTotals,
    )
    from backend.app.governance.guardian import (
        DealGuardian,
        GuardianEvaluationResult,
    )
    _GUARDIAN_AVAILABLE = True
except ImportError:
    try:
        from app.governance.context import (
            DealContext,
            CustomerContext,
            DealLineContext,
            DealTotals,
        )
        from app.governance.guardian import (
            DealGuardian,
            GuardianEvaluationResult,
        )
        _GUARDIAN_AVAILABLE = True
    except ImportError:
        _GUARDIAN_AVAILABLE = False


def dto_to_deal_context(dto: Any) -> Any:
    """Convert an Odoo DealContextDTO into a canonical DealContext for Deal Guardian."""
    if not _GUARDIAN_AVAILABLE:
        raise RuntimeError("Deal Guardian package is not available on Python path.")

    # Extract customer
    cust_data = getattr(dto, "customer", None)
    partner_id = getattr(cust_data, "id", getattr(cust_data, "partner_id", 1)) if cust_data else 1
    name = getattr(cust_data, "name", "Customer") if cust_data else "Customer"
    tier = getattr(cust_data, "tier", "Bronze") if cust_data else "Bronze"
    email = getattr(cust_data, "email", None) if cust_data else None
    company_name = getattr(cust_data, "company_name", None) if cust_data else None

    customer_ctx = CustomerContext(
        odoo_partner_id=int(partner_id),
        name=str(name),
        tier=str(tier or "Bronze"),
        email=email,
        company_name=company_name,
    )

    # Extract lines
    raw_lines = getattr(dto, "lines", []) or []
    lines: List[DealLineContext] = []
    for l in raw_lines:
        line_id = getattr(l, "line_id", 0)
        product_id = getattr(l, "product_id", 0)
        prod_name = getattr(l, "product_name", f"Product {product_id}")
        cat_name = getattr(l, "category_name", "General") or "General"
        cat_id = getattr(l, "category_id", 1)
        qty = float(getattr(l, "product_uom_qty", 1.0))
        price = float(getattr(l, "price_unit", 0.0))
        cost = float(getattr(l, "cost_price", 0.0))
        disc = float(getattr(l, "discount", 0.0))
        is_rec = bool(getattr(l, "is_recurring", False))
        rec_inv = getattr(l, "recurring_interval", None)

        lines.append(
            DealLineContext(
                odoo_line_id=int(line_id),
                odoo_product_id=int(product_id),
                product_name=str(prod_name),
                category_name=str(cat_name),
                odoo_category_id=int(cat_id) if cat_id else 1,
                quantity=qty,
                price_unit=price,
                cost_unit=cost,
                discount_pct=disc,
                is_recurring=is_rec,
                recurring_interval=rec_inv,
            )
        )

    deal_id = getattr(dto, "deal_id", None) or f"DEAL-{getattr(dto, 'order_id', 0)}"
    order_id = getattr(dto, "order_id", 0)
    order_name = getattr(dto, "order_name", f"SO{order_id:04d}")
    state = getattr(dto, "state", "draft")
    approval_state = getattr(dto, "dealflow_approval_state", "draft")
    currency = getattr(dto, "currency", "INR")

    ctx = DealContext(
        deal_id=str(deal_id),
        odoo_sale_order_id=int(order_id),
        order_name=str(order_name),
        customer=customer_ctx,
        lines=lines,
        status="DRAFT" if state in ("draft", "sent") else "CONFIRMED",
        approval_state=str(approval_state).upper() if approval_state else "DRAFT",
        currency=str(currency),
    )
    ctx.recalculate_totals()
    return ctx


class GovernanceAdapter:
    """Governance Adapter managing Deal Guardian evaluation and Odoo synchronization."""

    def __init__(
        self,
        env: Optional[Any] = None,
        guardian: Optional[Any] = None,
        db_bridge: Optional[Any] = None,
    ):
        self.env = env
        self.guardian = guardian or (DealGuardian() if _GUARDIAN_AVAILABLE else None)
        self.db_bridge = db_bridge

    def evaluate_deal(
        self,
        order_id: int,
        context_dto: Optional[Any] = None,
        approved_baseline_dto: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Run complete Deal Guardian governance pipeline and synchronize to Odoo.
        
        Returns:
            Dict containing Contract 2 decision snapshot.
        """
        if not self.guardian:
            logger.warning("DealGuardian engine not initialized. Evaluation returning mock safe.")
            return {
                "deal_id": f"DEAL-{order_id}",
                "risk": {"score": 0, "severity": "LOW", "factors": []},
                "approval": {"required": False, "level": "NONE", "current_stage": "DRAFT"},
            }

        if context_dto is None:
            if not self.env:
                raise RuntimeError("Either context_dto or an active Odoo Environment is required.")
            from dealflow_odoo.services.sales_adapter import SalesAdapter
            sales_adapter = SalesAdapter(self.env)
            context_dto = sales_adapter.get_deal_context(order_id)

        deal_context = dto_to_deal_context(context_dto)
        baseline_context = dto_to_deal_context(approved_baseline_dto) if approved_baseline_dto else None

        # Execute Deal Guardian Decision Engine
        eval_result = self.guardian.evaluate_deal(
            context=deal_context,
            approved_baseline=baseline_context,
        )
        res_dict = eval_result.model_dump()

        # Synchronize governance decision back into Odoo sale.order record
        if self.env:
            try:
                order = self.env["sale.order"].browse(order_id)
                if order.exists():
                    vals_to_write = {}
                    if hasattr(order, "dealflow_risk_score"):
                        vals_to_write["dealflow_risk_score"] = float(eval_result.risk.score)
                    if hasattr(order, "dealflow_approval_state"):
                        stage_val = eval_result.approval.current_stage.value.lower()
                        vals_to_write["dealflow_approval_state"] = stage_val
                    if hasattr(order, "dealflow_locked"):
                        is_locked = bool(eval_result.approval.required or eval_result.risk.score >= 60)
                        vals_to_write["dealflow_locked"] = is_locked

                    if vals_to_write:
                        order.write(vals_to_write)
            except Exception as odoo_sync_err:
                logger.warning("Failed to sync governance fields to Odoo order %s: %s", order_id, odoo_sync_err)

        # Dual-write to Decision Engine PostgreSQL Repositories
        if self.db_bridge:
            try:
                deal_uuid = deal_context.deal_id
                self.db_bridge.record_risk_assessment(
                    deal_id=deal_uuid,
                    risk_assessment_dict={
                        "score": eval_result.risk.score,
                        "severity": eval_result.risk.severity.value,
                        "factors": [f.model_dump() for f in eval_result.risk.factors],
                    },
                )
                self.db_bridge.log_audit_event(
                    deal_id=deal_uuid,
                    event_type="RISK_EVALUATED",
                    actor_role="Deal Guardian",
                    summary=f"Risk evaluated at {eval_result.risk.score}/100 ({eval_result.risk.severity.value})",
                    details=eval_result.narrative_explanation,
                )
            except Exception as db_sync_err:
                logger.warning("Failed to dual-write governance evaluation to PostgreSQL: %s", db_sync_err)

        return res_dict
