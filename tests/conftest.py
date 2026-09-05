# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Test Configuration & High-Fidelity Test Harness.

Provides pytest fixtures and a high-fidelity in-memory Odoo ORM / database mock
that mirrors Odoo models, relations, environment, security, and transactions.
"""

from __future__ import annotations

import os
os.environ["DEALFLOW_DB_ENABLED"] = "false"

import copy
import json
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional, Set, Union
from unittest.mock import MagicMock

import pytest

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    APPROVAL_STATE_REJECTED,
    CATEGORY_DISCOUNT_CEILINGS,
    DEFAULT_FINANCE_DISCOUNT_THRESHOLD,
    DEFAULT_MAX_REP_DISCOUNT,
    HEALTH_STATUS_AT_RISK,
    HEALTH_STATUS_CRITICAL,
    HEALTH_STATUS_HEALTHY,
    RISK_LEVEL_LOW,
    RISK_LEVEL_HIGH,
)
from dealflow_odoo.schemas import (
    AuthorizationError,
    CustomerDTO,
    DealContextDTO,
    FulfillmentPlanDTO,
    FulfillmentSplitItem,
    InvalidStateError,
    NegotiationRequestDTO,
    NotFoundError,
    OrderLineDTO,
    ProductDTO,
    ValidationError,
)
from dealflow_odoo.services.accounting_adapter import AccountingAdapter
from dealflow_odoo.services.event_dispatcher import EventDispatcher
from dealflow_odoo.services.integration_service import OdooIntegrationService
from dealflow_odoo.services.inventory_adapter import InventoryAdapter
from dealflow_odoo.services.sales_adapter import SalesAdapter
from dealflow_odoo.services.subscription_adapter import SubscriptionAdapter


# =============================================================================
# HIGH-FIDELITY MOCK ODOO ORM RECORDSET & ENVIRONMENT
# =============================================================================

class MockRecordSet:
    """Simulates an Odoo RecordSet with list-like behavior, browsing, filtering, and attribute access."""

    def __init__(self, records: Optional[List[Any]] = None, model_name: str = ""):
        self._records: List[Any] = list(records or [])
        self._model_name = model_name

    def __len__(self) -> int:
        return len(self._records)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._records)

    def __getitem__(self, item: Any) -> Any:
        if isinstance(item, slice):
            return MockRecordSet(self._records[item], self._model_name)
        return self._records[item]

    def __bool__(self) -> bool:
        return len(self._records) > 0

    @property
    def ids(self) -> List[int]:
        return [r.id for r in self._records if hasattr(r, "id") and r.id]

    def exists(self) -> MockRecordSet:
        existing = [r for r in self._records if getattr(r, "_is_existing", True)]
        return MockRecordSet(existing, self._model_name)

    def ensure_one(self) -> Any:
        if len(self._records) != 1:
            raise ValueError(f"Expected singleton recordset for {self._model_name}, got {len(self._records)} records.")
        return self._records[0]

    def filtered(self, func: Callable[[Any], bool]) -> MockRecordSet:
        return MockRecordSet([r for r in self._records if func(r)], self._model_name)

    def sorted(self, key: Optional[Callable[[Any], Any]] = None, reverse: bool = False) -> MockRecordSet:
        if key:
            return MockRecordSet(sorted(self._records, key=key, reverse=reverse), self._model_name)
        return MockRecordSet(list(self._records), self._model_name)

    def mapped(self, field_name: str) -> List[Any]:
        return [getattr(r, field_name) for r in self._records if hasattr(r, field_name)]

    def with_context(self, *args: Any, **kwargs: Any) -> MockRecordSet:
        return self

    def sudo(self, *args: Any, **kwargs: Any) -> MockRecordSet:
        return self

    def __getattr__(self, name: str) -> Any:
        # If recordset is singleton, delegate attribute access to single record
        if len(self._records) == 1:
            return getattr(self._records[0], name)
        raise AttributeError(f"'{self.__class__.__name__}' object for {self._model_name} (len={len(self._records)}) has no attribute '{name}'")


class MockBaseRecord:
    """Base class for in-memory Odoo records mimicking fields and common ORM methods."""

    def __init__(self, values: Dict[str, Any], env: Any, model_name: str = ""):
        self._model_name = model_name or getattr(self, "_model_name", "record")
        self._env = env
        self._values: Dict[str, Any] = dict(values)
        self._is_existing = True
        self.id = values.get("id", 0)

        # Populate attributes directly
        for k, v in values.items():
            setattr(self, k, v)

    def exists(self) -> bool:
        return self._is_existing

    def ensure_one(self) -> MockBaseRecord:
        return self

    def with_context(self, *args: Any, **kwargs: Any) -> MockBaseRecord:
        return self

    def sudo(self, *args: Any, **kwargs: Any) -> MockBaseRecord:
        return self

    def write(self, vals: Dict[str, Any]) -> bool:
        self._values.update(vals)
        for k, v in vals.items():
            setattr(self, k, v)
        return True

    def has_group(self, group: str) -> bool:
        groups = getattr(self, "groups", set())
        if isinstance(groups, (set, list, tuple)):
            return group in groups
        return False

    def _is_public(self) -> bool:
        return bool(getattr(self, "is_public", False))

    def __getattr__(self, name: str) -> Any:
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        if "_values" in self.__dict__ and name in self._values:
            return self._values[name]
        if name == "display_name":
            return getattr(self, "name", "")
        if name == "ids":
            return [self.id] if self.id else []
        if name == "child_ids":
            return MockRecordSet([], "res.partner")
        if name == "commercial_partner_id":
            return self
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")

    def __repr__(self) -> str:
        name = getattr(self, "name", getattr(self, "id", "record"))
        return f"<{self._model_name}({self.id}): {name}>"


class MockDealflowNegotiation(MockBaseRecord):
    """Mock for dealflow.negotiation model."""

    def __init__(self, values: Dict[str, Any], env: Any):
        super().__init__(values, env, "dealflow.negotiation")
        if not getattr(self, "name", None) or self.name == "New":
            self.name = f"NEG-{values.get('sale_order_id', 0)}-{values.get('id', 1)}"
        self.status = values.get("status", "submitted")
        self.requested_discount = float(values.get("requested_discount", 0.0))
        self.requested_terms = values.get("requested_terms", "")
        self.customer_note = values.get("customer_note", "")
        self.original_amount = float(values.get("original_amount", 0.0))
        self.proposed_amount = float(values.get("proposed_amount", 0.0))
        self.submitted_at = values.get("submitted_at", "2026-09-05 10:00:00")
        self.review_note = values.get("review_note")

        # Automatically apply governance side-effects to sale.order upon creation
        order_id = values.get("sale_order_id")
        if order_id and env:
            order = env["sale.order"].browse(order_id)
            if order.exists():
                order.write({
                    "dealflow_approval_state": "pending_approval",
                    "dealflow_locked": True,
                })
                order.message_post(f"Customer negotiation submitted: {self.name}")

    @property
    def partner_id(self):
        order_id = getattr(self, "sale_order_id", None)
        if order_id and self._env:
            order = self._env["sale.order"].browse(order_id)
            if order.exists():
                return order.partner_id
        return None

    def action_under_review(self) -> bool:
        self.status = "under_review"
        return True

    def action_approve(self, review_note: Optional[str] = None) -> bool:
        user = getattr(self._env, "user", None)
        if user:
            if (
                user.has_group("base.group_portal")
                or user.has_group("dealflow_odoo.group_dealflow_portal")
                or not user.has_group("base.group_user")
            ):
                raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot approve negotiations.")
            if user.has_group("dealflow_odoo.group_dealflow_sales_rep"):
                is_finance = user.has_group("dealflow_odoo.group_dealflow_finance") or user.has_group("dealflow_odoo.group_dealflow_admin")
                if not is_finance and self.requested_discount > DEFAULT_FINANCE_DISCOUNT_THRESHOLD:
                    raise AuthorizationError(
                        f"Approval denied: Discounts exceeding {DEFAULT_FINANCE_DISCOUNT_THRESHOLD}% require DealFlow Finance approval."
                    )

        self.status = "approved"
        if review_note:
            self.review_note = review_note
        order_id = getattr(self, "sale_order_id", None)
        if order_id and self._env:
            order = self._env["sale.order"].browse(order_id)
            if order.exists():
                order.write({"dealflow_locked": False, "dealflow_approval_state": "approved"})
        return True

    def action_reject(self, review_note: Optional[str] = None) -> bool:
        self.status = "rejected"
        if review_note:
            self.review_note = review_note
        order_id = getattr(self, "sale_order_id", None)
        if order_id and self._env:
            order = self._env["sale.order"].browse(order_id)
            if order.exists():
                order.write({"dealflow_locked": False, "dealflow_approval_state": "rejected"})
        return True


class MockSaleOrder(MockBaseRecord):
    """High-fidelity mock of sale.order implementing DealFlow governance logic."""

    def __init__(self, values: Dict[str, Any], env: Any):
        super().__init__(values, env, "sale.order")
        self.dealflow_deal_id = values.get("dealflow_deal_id")
        self.dealflow_risk_score = float(values.get("dealflow_risk_score", 0.0))
        self.dealflow_approval_state = values.get("dealflow_approval_state", APPROVAL_STATE_DRAFT)
        self.dealflow_health_status = values.get("dealflow_health_status", HEALTH_STATUS_HEALTHY)
        self.dealflow_locked = bool(values.get("dealflow_locked", False))
        self.dealflow_last_evaluated_at = values.get("dealflow_last_evaluated_at")
        self.dealflow_blended_discount = float(values.get("dealflow_blended_discount", 0.0))
        if "picking_ids" in values:
            self._custom_picking_ids = values["picking_ids"]
        self.invoice_ids = values.get("invoice_ids", MockRecordSet([], "account.move"))
        self.partner_id = values.get("partner_id")
        self.partner_shipping_id = values.get("partner_shipping_id", self.partner_id)
        self.currency_id = values.get("currency_id", type("Currency", (), {"id": 1, "name": "USD", "symbol": "$"})())
        self.chatter_messages: List[str] = []
        self._compute_blended_discount()

    def _compute_blended_discount(self) -> None:
        total_list = 0.0
        total_disc = 0.0
        lines = getattr(self, "order_line", [])
        for line in lines:
            if getattr(line, "display_type", False):
                continue
            gross = float(getattr(line, "price_unit", 0.0)) * float(getattr(line, "product_uom_qty", 0.0))
            disc = float(getattr(line, "discount", 0.0))
            total_list += gross
            total_disc += gross * (disc / 100.0)

        if total_list > 0:
            self.dealflow_blended_discount = round((total_disc / total_list) * 100.0, 2)
        else:
            self.dealflow_blended_discount = 0.0

        subtotal_sum = sum(float(getattr(l, "price_subtotal", 0.0)) for l in lines if not getattr(l, "display_type", False))
        if subtotal_sum > 0:
            self.amount_untaxed = round(subtotal_sum, 2)
            self.amount_tax = round(subtotal_sum * 0.1, 2)
            self.amount_total = round(self.amount_untaxed + self.amount_tax, 2)

    def message_post(self, body: str = "", **kwargs: Any) -> None:
        self.chatter_messages.append(body)

    def write(self, vals: Dict[str, Any]) -> bool:
        user = getattr(self._env, "user", None)
        if user and vals.get("dealflow_approval_state") == APPROVAL_STATE_APPROVED:
            is_portal = (
                user.has_group("base.group_portal")
                or user.has_group("dealflow_odoo.group_dealflow_portal")
                or not user.has_group("base.group_user")
            )
            if is_portal:
                raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot update order approval state.")
            if user.has_group("dealflow_odoo.group_dealflow_sales_rep"):
                is_finance = user.has_group("dealflow_odoo.group_dealflow_finance") or user.has_group("dealflow_odoo.group_dealflow_admin")
                if not is_finance and self.dealflow_blended_discount > DEFAULT_FINANCE_DISCOUNT_THRESHOLD:
                    raise AuthorizationError(
                        f"Privilege Escalation Blocked: Sales Rep cannot approve order exceeding {DEFAULT_FINANCE_DISCOUNT_THRESHOLD}% discount."
                    )

        ctx = getattr(self._env, "context", {}) or {}
        skip_reapproval = ctx.get("dealflow_skip_reapproval", False)

        is_approved = self.dealflow_approval_state == APPROVAL_STATE_APPROVED
        reapproval_trigger = False

        if not skip_reapproval and is_approved:
            if "order_line" in vals or "discount" in vals or "note" in vals:
                reapproval_trigger = True

        res = super().write(vals)
        self._compute_blended_discount()

        if reapproval_trigger:
            self.dealflow_approval_state = APPROVAL_STATE_REAPPROVAL_REQUIRED
            self.dealflow_locked = True
            self.message_post("Terms modified after approval: DealFlow reapproval required.")

        return res

    def action_get_deal_context(self, as_dict: bool = False) -> Union[DealContextDTO, Dict[str, Any]]:
        self._compute_blended_discount()
        partner = self.partner_id
        customer_dto = CustomerDTO(
            id=partner.id,
            name=partner.name,
            email=getattr(partner, "email", None),
            phone=getattr(partner, "phone", None),
            credit_limit=float(getattr(partner, "credit_limit", 0.0)),
            total_invoiced=float(getattr(partner, "total_invoiced", 0.0)),
            is_company=bool(getattr(partner, "is_company", True)),
            street=getattr(partner, "street", None),
            city=getattr(partner, "city", None),
            country=getattr(getattr(partner, "country_id", None), "name", None),
        )

        lines_dto: List[OrderLineDTO] = []
        total_cost = 0.0
        total_margin = 0.0
        has_recurring = False
        mrr = 0.0
        arr = 0.0

        for line in getattr(self, "order_line", []):
            if getattr(line, "display_type", False):
                continue
            prod = line.product_id
            cat_name = prod.categ_id.name if getattr(prod, "categ_id", None) else "All"
            qty = float(line.product_uom_qty)
            price_unit = float(line.price_unit)
            discount = float(line.discount)
            cost_price = float(getattr(line, "dealflow_cost_price", getattr(prod, "standard_price", 0.0)))
            subtotal = (qty * price_unit) * (1.0 - (discount / 100.0))
            line_cost = cost_price * qty
            line_margin = subtotal - line_cost
            margin_pct = (line_margin / subtotal * 100.0) if subtotal > 0 else 0.0

            is_rec = bool(getattr(line, "dealflow_is_recurring", getattr(prod, "is_recurring", False)))
            rec_interval = getattr(line, "dealflow_recurring_interval", getattr(prod, "recurring_interval", None))

            if is_rec:
                has_recurring = True
                if rec_interval == "year":
                    arr += subtotal
                    mrr += subtotal / 12.0
                else:
                    mrr += subtotal
                    arr += subtotal * 12.0

            total_cost += line_cost
            total_margin += line_margin

            lines_dto.append(
                OrderLineDTO(
                    id=line.id,
                    product_id=prod.id,
                    product_name=prod.name,
                    category_name=cat_name,
                    product_uom_qty=qty,
                    price_unit=price_unit,
                    cost_price=cost_price,
                    discount=discount,
                    price_subtotal=round(subtotal, 2),
                    margin=round(line_margin, 2),
                    margin_percent=round(margin_pct, 2),
                    is_recurring=is_rec,
                    recurring_interval=rec_interval,
                )
            )

        amt_untaxed = float(self.amount_untaxed)
        margin_percent = (total_margin / amt_untaxed * 100.0) if amt_untaxed > 0 else 0.0

        dto = DealContextDTO(
            deal_id=self.dealflow_deal_id,
            order_id=self.id,
            order_name=self.name,
            customer=customer_dto,
            state=self.state,
            date_order=str(self.date_order),
            currency=self.currency_id.name,
            amount_untaxed=round(amt_untaxed, 2),
            amount_tax=round(float(self.amount_tax), 2),
            amount_total=round(float(self.amount_total), 2),
            blended_discount=round(self.dealflow_blended_discount, 2),
            total_cost=round(total_cost, 2),
            total_margin=round(total_margin, 2),
            margin_percent=round(margin_percent, 2),
            lines=lines_dto,
            has_recurring_lines=has_recurring,
            mrr=round(mrr, 2),
            arr=round(arr, 2),
            dealflow_risk_score=float(self.dealflow_risk_score),
            dealflow_approval_state=self.dealflow_approval_state,
            dealflow_health_status=self.dealflow_health_status,
            dealflow_locked=bool(self.dealflow_locked),
        )
        if as_dict:
            return asdict(dto)
        return dto

    def action_dealflow_lock(self) -> bool:
        self.dealflow_locked = True
        self.message_post("Order locked pending DealFlow approval.")
        return True

    def action_dealflow_unlock(self, actor: Optional[Any] = None) -> bool:
        user = getattr(self._env, "user", None)
        target = actor if actor is not None else user
        if target:
            is_authorized = False
            if hasattr(target, "has_group"):
                is_authorized = (
                    target.has_group("dealflow_odoo.group_dealflow_sales_manager")
                    or target.has_group("dealflow_odoo.group_dealflow_finance")
                    or target.has_group("dealflow_odoo.group_dealflow_admin")
                    or getattr(target, "is_superuser", False)
                )
            elif isinstance(target, dict):
                role = target.get("role", "")
                is_authorized = role in ("manager", "sales_manager", "finance", "admin")
            elif isinstance(target, str):
                is_authorized = target.lower() in ("manager", "sales_manager", "finance", "admin")

            if not is_authorized:
                raise AuthorizationError(
                    "Permission denied: Actor is not authorized to unlock DealFlow orders. Manager or Finance role required."
                )

        self.dealflow_locked = False
        self.message_post("Order unlocked.")
        return True

    def action_dealflow_evaluate_governance(self) -> Dict[str, Any]:
        self._compute_blended_discount()
        category_breaches = []
        has_negative_margin = False
        total_list = 0.0
        total_cost = 0.0

        for line in getattr(self, "order_line", []):
            if getattr(line, "display_type", False):
                continue
            prod = line.product_id
            cat_name = prod.categ_id.name if getattr(prod, "categ_id", None) else "All"
            ceiling = CATEGORY_DISCOUNT_CEILINGS.get(cat_name, DEFAULT_MAX_REP_DISCOUNT)
            disc = float(getattr(line, "discount", 0.0))
            if disc > ceiling:
                category_breaches.append({
                    "line_id": line.id,
                    "product": getattr(line, "name", ""),
                    "category": cat_name,
                    "discount": disc,
                    "ceiling": ceiling,
                    "excess": disc - ceiling,
                })

            qty = float(getattr(line, "product_uom_qty", 0.0))
            price = float(getattr(line, "price_unit", 0.0))
            cost = float(getattr(line, "dealflow_cost_price", getattr(prod, "standard_price", 0.0)))
            subtotal = (qty * price) * (1.0 - (disc / 100.0))
            line_cost = cost * qty
            total_list += qty * price
            total_cost += line_cost
            if subtotal < line_cost:
                has_negative_margin = True

        total_margin = float(getattr(self, "amount_untaxed", 0.0)) - total_cost

        # Calculate explainable risk score
        risk = 0.0
        if self.dealflow_blended_discount > DEFAULT_MAX_REP_DISCOUNT:
            risk += (self.dealflow_blended_discount - DEFAULT_MAX_REP_DISCOUNT) * 1.5

        for b in category_breaches:
            risk += b["excess"] * 2.0 + 15.0

        if total_margin < 0.0 or has_negative_margin:
            risk += 35.0

        is_free_deal = any(float(getattr(l, "discount", 0.0)) >= 100.0 for l in getattr(self, "order_line", []) if not getattr(l, "display_type", False)) or (total_list > 0 and self.dealflow_blended_discount >= 100.0)
        if is_free_deal:
            risk = 100.0

        self.dealflow_risk_score = round(min(100.0, max(0.0, risk)), 2)

        if is_free_deal or self.dealflow_blended_discount >= DEFAULT_FINANCE_DISCOUNT_THRESHOLD or total_margin < 0.0:
            self.dealflow_health_status = HEALTH_STATUS_CRITICAL
            if self.dealflow_approval_state != APPROVAL_STATE_APPROVED:
                self.dealflow_locked = True
        elif category_breaches or self.dealflow_blended_discount > DEFAULT_MAX_REP_DISCOUNT:
            self.dealflow_health_status = HEALTH_STATUS_AT_RISK
            if self.dealflow_approval_state != APPROVAL_STATE_APPROVED:
                self.dealflow_locked = True
        else:
            self.dealflow_health_status = HEALTH_STATUS_HEALTHY

        self.dealflow_last_evaluated_at = datetime.now().isoformat()
        return {
            "risk_score": self.dealflow_risk_score,
            "health_status": self.dealflow_health_status,
            "dealflow_locked": self.dealflow_locked,
            "category_breaches": category_breaches,
            "is_free_deal": is_free_deal,
            "has_negative_margin": has_negative_margin,
        }

    def action_dealflow_apply_approved_change(self, changes: Dict[str, Any]) -> bool:
        user = getattr(self._env, "user", None)
        if user:
            is_portal = (
                user.has_group("base.group_portal")
                or user.has_group("dealflow_odoo.group_dealflow_portal")
                or not user.has_group("base.group_user")
            )
            if is_portal:
                raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot apply approved changes.")
            if user.has_group("dealflow_odoo.group_dealflow_sales_rep"):
                is_finance = user.has_group("dealflow_odoo.group_dealflow_finance") or user.has_group("dealflow_odoo.group_dealflow_admin")
                if not is_finance:
                    discounts = []
                    if "discount" in changes:
                        discounts.append(float(changes["discount"]))
                    if "target_line_discounts" in changes and isinstance(changes["target_line_discounts"], dict):
                        discounts.extend(float(d) for d in changes["target_line_discounts"].values())
                    if "line_discounts" in changes and isinstance(changes["line_discounts"], dict):
                        discounts.extend(float(d) for d in changes["line_discounts"].values())
                    if any(d > DEFAULT_FINANCE_DISCOUNT_THRESHOLD for d in discounts):
                        raise AuthorizationError(f"Privilege Escalation Blocked: Sales Rep cannot approve discounts exceeding {DEFAULT_FINANCE_DISCOUNT_THRESHOLD}%.")

        line_discounts = changes.get("target_line_discounts") or changes.get("line_discounts") or {}
        if isinstance(line_discounts, dict):
            for line_id_key, disc in line_discounts.items():
                for line in self.order_line:
                    if line.id == int(line_id_key):
                        line.discount = float(disc)
                        line.dealflow_approved_discount = float(disc)
                        qty = float(line.product_uom_qty)
                        unit = float(line.price_unit)
                        line.price_subtotal = (qty * unit) * (1.0 - (float(disc) / 100.0))

        if "discount" in changes and not line_discounts:
            d = float(changes["discount"])
            for line in self.order_line:
                line.discount = d
                line.dealflow_approved_discount = d
                qty = float(line.product_uom_qty)
                unit = float(line.price_unit)
                line.price_subtotal = (qty * unit) * (1.0 - (d / 100.0))

        self.dealflow_approval_state = APPROVAL_STATE_APPROVED
        self.dealflow_locked = False
        self.dealflow_last_evaluated_at = datetime.now().isoformat()
        if "dealflow_risk_score" in changes:
            self.dealflow_risk_score = float(changes["dealflow_risk_score"])

        self._compute_blended_discount()
        subtotal_sum = sum(l.price_subtotal for l in self.order_line if not getattr(l, "display_type", False))
        self.amount_untaxed = round(subtotal_sum, 2)
        self.amount_tax = round(subtotal_sum * 0.1, 2)
        self.amount_total = round(self.amount_untaxed + self.amount_tax, 2)

        self.message_post("DealFlow Governance: Approved changes applied atomically.")
        return True

    def action_dealflow_confirm(self) -> bool:
        user = getattr(self._env, "user", None)
        if user and (
            user.has_group("base.group_portal")
            or user.has_group("dealflow_odoo.group_dealflow_portal")
            or not user.has_group("base.group_user")
        ):
            raise AuthorizationError("Privilege Escalation Blocked: Portal users cannot confirm sales orders directly.")

        self._compute_blended_discount()
        exceeds_threshold = self.dealflow_blended_discount > DEFAULT_MAX_REP_DISCOUNT or any(
            l.discount > DEFAULT_MAX_REP_DISCOUNT for l in self.order_line if not getattr(l, "display_type", False)
        )
        has_category_breach = any(
            float(getattr(l, "discount", 0.0)) > CATEGORY_DISCOUNT_CEILINGS.get(
                l.product_id.categ_id.name if getattr(l, "product_id", None) and getattr(l.product_id, "categ_id", None) else "All",
                DEFAULT_MAX_REP_DISCOUNT
            )
            for l in self.order_line if not getattr(l, "display_type", False)
        )
        if (self.dealflow_locked or exceeds_threshold or has_category_breach) and self.dealflow_approval_state != APPROVAL_STATE_APPROVED:
            raise AuthorizationError("Order locked pending DealFlow approval")

        self.state = "sale"
        return True

    def action_confirm(self) -> bool:
        return self.action_dealflow_confirm()

    def _create_invoices(self, final: bool = True) -> MockRecordSet:
        if self.state not in ("sale", "done"):
            raise InvalidStateError(f"Cannot invoice order in state '{self.state}'. Order must be confirmed.")

        active_invoices = [inv for inv in self.invoice_ids if getattr(inv, "state", "") != "cancel" and getattr(inv, "move_type", "") != "out_refund"]
        if active_invoices:
            already_invoiced = sum(float(getattr(inv, "amount_total", 0.0)) for inv in active_invoices)
            if self.amount_total > 0 and already_invoiced >= self.amount_total:
                raise InvalidStateError(f"Order {self.id} is already fully invoiced.")
            elif self.amount_total == 0.0 and len(active_invoices) > 0:
                raise InvalidStateError(f"Order {self.id} is already invoiced.")

        inv_model = self._env["account.move"]
        inv_id = len(inv_model._store) + 1
        inv_vals = {
            "id": inv_id,
            "name": f"INV/2026/{inv_id:04d}",
            "partner_id": self.partner_id,
            "amount_total": self.amount_total,
            "amount_untaxed": self.amount_untaxed,
            "amount_tax": self.amount_tax,
            "amount_residual": self.amount_total,
            "state": "posted",
            "payment_state": "not_paid",
            "dealflow_deal_id": self.dealflow_deal_id,
            "order_id": self.id,
            "move_type": "out_invoice",
        }
        inv = inv_model.create(inv_vals)
        existing_invoices = list(self.invoice_ids)
        existing_invoices.append(inv)
        self.invoice_ids = MockRecordSet(existing_invoices, "account.move")
        return MockRecordSet([inv], "account.move")

    @property
    def picking_ids(self) -> MockRecordSet:
        if hasattr(self, "_custom_picking_ids"):
            return self._custom_picking_ids
        all_pickings = self._env["stock.picking"].search([])
        order_pickings = [
            p for p in all_pickings
            if getattr(p, "sale_id", None) == self.id or getattr(p, "origin", None) == self.name
        ]
        return MockRecordSet(order_pickings, "stock.picking")

    @picking_ids.setter
    def picking_ids(self, val: Any) -> None:
        self._custom_picking_ids = val


class MockSaleOrderLine(MockBaseRecord):
    """Mock for sale.order.line."""

    def __init__(self, values: Dict[str, Any], env: Any):
        if "discount" in values:
            d = float(values["discount"])
            if d < 0.0 or d > 100.0:
                raise ValidationError(f"Discount must be between 0.0% and 100.0%. Got {d}%.")
        if not values.get("display_type", False) and "product_uom_qty" in values:
            q = float(values["product_uom_qty"])
            if q <= 0.0:
                raise ValidationError(f"Quantity must be strictly positive. Got {q}.")

        super().__init__(values, env, "sale.order.line")
        self.display_type = values.get("display_type", False)
        self.dealflow_approved_discount = float(values.get("dealflow_approved_discount", 0.0))
        self.dealflow_is_recurring = bool(values.get("dealflow_is_recurring", False))
        self.dealflow_recurring_interval = values.get("dealflow_recurring_interval")
        self.dealflow_cost_price = float(values.get("dealflow_cost_price", 0.0))
        self.product_uom = values.get("product_uom", type("UoM", (), {"id": 1, "name": "Units"})())
        self.order_id = values.get("order_id")

    def write(self, vals: Dict[str, Any]) -> bool:
        if "discount" in vals:
            d = float(vals["discount"])
            if d < 0.0 or d > 100.0:
                raise ValidationError(f"Discount must be between 0.0% and 100.0%. Got {d}%.")
        if "product_uom_qty" in vals:
            q = float(vals["product_uom_qty"])
            if not getattr(self, "display_type", False) and q <= 0.0:
                raise ValidationError(f"Quantity must be strictly positive. Got {q}.")

        res = super().write(vals)
        if "discount" in vals or "price_unit" in vals or "product_uom_qty" in vals:
            qty = float(getattr(self, "product_uom_qty", 0.0))
            price = float(getattr(self, "price_unit", 0.0))
            disc = float(getattr(self, "discount", 0.0))
            self.price_subtotal = round((qty * price) * (1.0 - (disc / 100.0)), 2)
            if self.order_id and getattr(self.order_id, "dealflow_approval_state", "") == APPROVAL_STATE_APPROVED:
                self.order_id.dealflow_approval_state = APPROVAL_STATE_REAPPROVAL_REQUIRED
                self.order_id.dealflow_locked = True
        if self.order_id and hasattr(self.order_id, "_compute_blended_discount"):
            self.order_id._compute_blended_discount()
        return res


class MockProduct(MockBaseRecord):
    """Mock product.product supporting warehouse context for free_qty and multi-warehouse split."""

    def __init__(self, values: Dict[str, Any], env: Any):
        super().__init__(values, env, "product.product")

    def with_context(self, *args: Any, **kwargs: Any) -> Any:
        wh_id = kwargs.get("warehouse")
        if wh_id:
            quants = self._env["stock.quant"].search([])
            wh_qty = 0.0
            for q in quants:
                prod_id = getattr(getattr(q, "product_id", None), "id", None)
                loc_wh = getattr(getattr(q, "location_id", None), "warehouse_id", None)
                loc_wh_id = getattr(loc_wh, "id", None)
                if prod_id == self.id and loc_wh_id == wh_id:
                    wh_qty += float(getattr(q, "quantity", 0.0)) - float(getattr(q, "reserved_quantity", 0.0))

            proxy = copy.copy(self)
            proxy.free_qty = wh_qty
            proxy.qty_available = wh_qty
            proxy.outgoing_qty = 0.0
            proxy.incoming_qty = 0.0
            return proxy
        return self


class MockStockPicking(MockBaseRecord):
    """Mock stock.picking wrapping relational IDs into record proxies."""

    def __init__(self, values: Dict[str, Any], env: Any):
        super().__init__(values, env, "stock.picking")
        self.state = values.get("state", "assigned")
        self.name = values.get("name", f"WH/OUT/{self.id:04d}")
        self.origin = values.get("origin", "")
        self.sale_id = values.get("sale_id")
        self.dealflow_fulfillment_batch_id = values.get("dealflow_fulfillment_batch_id")
        self.dealflow_warehouse_split = values.get("dealflow_warehouse_split", False)
        self.dealflow_split_details = values.get("dealflow_split_details")

        loc_id = values.get("location_id", 10)
        if isinstance(loc_id, int):
            self.location_id = type("Location", (), {"id": loc_id, "name": f"Stock {loc_id}"})()

        dest_id = values.get("location_dest_id", 20)
        if isinstance(dest_id, int):
            self.location_dest_id = type("Location", (), {"id": dest_id, "name": f"Customer {dest_id}"})()

        pt_id = values.get("picking_type_id")
        wh_id = pt_id or 1
        wh_rec = env["stock.warehouse"].browse(wh_id) if env and hasattr(env, "_models") and "stock.warehouse" in env._models else None
        wh_name = getattr(wh_rec, "name", None) or ("WH1 Main" if wh_id == 1 else "WH2 East")
        wh_obj = type("WH", (), {"id": wh_id, "name": wh_name})()
        self.picking_type_id = type("PickingType", (), {"id": wh_id, "warehouse_id": wh_obj})()

    def get_split_details_dict(self) -> Optional[Union[List[Dict[str, Any]], Dict[str, Any]]]:
        """Parses and returns the JSON split allocation details, or None if empty."""
        split_details_val = getattr(self, "dealflow_split_details", None)
        if not split_details_val:
            return None
        try:
            return json.loads(split_details_val)
        except (ValueError, TypeError):
            return None

    def action_view_batch_pickings(self) -> Any:
        """Returns an Odoo window action to view all pickings in this fulfillment batch."""
        if hasattr(self, "ensure_one"):
            self.ensure_one()
        batch_id = getattr(self, "dealflow_fulfillment_batch_id", None)
        if not batch_id:
            return False
        return {
            "name": f"Batch Pickings ({batch_id})",
            "type": "ir.actions.act_window",
            "res_model": "stock.picking",
            "view_mode": "tree,form",
            "domain": [("dealflow_fulfillment_batch_id", "=", batch_id)],
            "context": dict(self._env.context if hasattr(self, "_env") and self._env else {}),
        }

    def action_cancel(self) -> bool:
        self.state = "cancel"
        return True


class MockModel:
    """Simulates an Odoo Model table with search, browse, create, and write capabilities."""

    def __init__(self, model_name: str, env: Any, record_cls: type = MockBaseRecord):
        self.model_name = model_name
        self.env = env
        self.record_cls = record_cls
        self._store: Dict[int, Any] = {}
        self._next_id: int = 1

    def sudo(self, *args: Any, **kwargs: Any) -> MockModel:
        return self

    def with_context(self, *args: Any, **kwargs: Any) -> MockModel:
        return self

    def create(self, vals: Dict[str, Any]) -> Any:
        record_id = vals.get("id") or self._next_id
        if record_id >= self._next_id:
            self._next_id = record_id + 1
        vals["id"] = record_id
        record = self.record_cls(vals, self.env)
        self._store[record_id] = record
        return record

    def browse(self, ids: Union[int, List[int]]) -> Any:
        if isinstance(ids, int):
            rec = self._store.get(ids)
            if rec:
                return rec
            non_existing = self.record_cls({"id": ids}, self.env)
            non_existing._is_existing = False
            return non_existing
        elif isinstance(ids, (list, tuple)):
            recs = [self._store[i] for i in ids if i in self._store]
            return MockRecordSet(recs, self.model_name)
        return MockRecordSet([], self.model_name)

    def search(self, domain: List[Any], order: Optional[str] = None, limit: Optional[int] = None) -> MockRecordSet:
        matched = []
        for rec in self._store.values():
            match = True
            for condition in domain:
                if isinstance(condition, (list, tuple)) and len(condition) == 3:
                    field_name, op, expected = condition
                    actual = rec
                    for part in field_name.split("."):
                        actual = getattr(actual, part, None)
                    if op == "=" and actual != expected:
                        match = False
                        break
                    elif op == "!=" and actual == expected:
                        match = False
                        break
                    elif op == "in" and actual not in expected:
                        match = False
                        break
                    elif op == "not in" and actual in expected:
                        match = False
                        break
            if match:
                matched.append(rec)

        if order:
            parts = [p.strip() for p in order.split(",")]
            for part in reversed(parts):
                field_dir = part.split()
                fname = field_dir[0]
                desc = len(field_dir) > 1 and field_dir[1].lower() == "desc"
                matched.sort(key=lambda r: getattr(r, fname, 0) or 0, reverse=desc)

        if limit:
            matched = matched[:limit]
        return MockRecordSet(matched, self.model_name)


class MockCursor:
    """Simulates Odoo env.cr with transaction savepoints."""

    class SavepointContext:
        def __enter__(self) -> MockCursor.SavepointContext:
            return self

        def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
            pass

    def savepoint(self) -> MockCursor.SavepointContext:
        return self.SavepointContext()


class MockEnvironment:
    """High-fidelity Odoo Environment mock providing model dictionary lookup and context."""

    def __init__(self):
        self.cr = MockCursor()
        self.context: Dict[str, Any] = {}
        self.uid: int = 1
        self._models: Dict[str, MockModel] = {
            "res.partner": MockModel("res.partner", self),
            "product.category": MockModel("product.category", self),
            "product.product": MockModel("product.product", self, record_cls=MockProduct),
            "stock.warehouse": MockModel("stock.warehouse", self),
            "stock.quant": MockModel("stock.quant", self),
            "stock.picking": MockModel("stock.picking", self, record_cls=MockStockPicking),
            "stock.move": MockModel("stock.move", self),
            "sale.order": MockModel("sale.order", self, record_cls=MockSaleOrder),
            "sale.order.line": MockModel("sale.order.line", self, record_cls=MockSaleOrderLine),
            "account.move": MockModel("account.move", self),
            "dealflow.negotiation": MockModel("dealflow.negotiation", self, record_cls=MockDealflowNegotiation),
            "res.users": MockModel("res.users", self),
        }
        self.user = self["res.users"].create({
            "id": 1,
            "name": "Mitchell Admin",
            "partner_id": self["res.partner"].create({"id": 999, "name": "Mitchell Admin", "is_company": False}),
            "groups": {"base.group_user", "dealflow_odoo.group_dealflow_admin"},
        })

    def __getitem__(self, model_name: str) -> MockModel:
        if model_name not in self._models:
            self._models[model_name] = MockModel(model_name, self)
        return self._models[model_name]

    def __contains__(self, model_name: Any) -> bool:
        return model_name in self._models

    def get(self, model_name: str, default: Any = None) -> Any:
        return self._models.get(model_name, default)

    def ref(self, xml_id: str) -> Any:
        return type("XmlRef", (), {"id": 1, "name": xml_id})()


# =============================================================================
# SEED DATA LOADER
# =============================================================================

def load_seed_data(env: MockEnvironment) -> Dict[str, Any]:
    """Populates the mock environment with the complete canonical DealFlow seed dataset."""
    Partner = env["res.partner"]
    Category = env["product.category"]
    Product = env["product.product"]
    Warehouse = env["stock.warehouse"]
    Quant = env["stock.quant"]

    # 1. Customers
    acme = Partner.create({
        "id": 1,
        "name": "Acme Corp",
        "email": "contact@acme.example.com",
        "phone": "+1 (555) 019-2831",
        "street": "100 Enterprise Way",
        "city": "Austin",
        "country_id": type("Country", (), {"id": 1, "name": "United States"})(),
        "credit_limit": 50000.0,
        "total_invoiced": 12000.0,
        "is_company": True,
    })

    beta = Partner.create({
        "id": 2,
        "name": "Beta Industries",
        "email": "procurement@betaindustries.example.com",
        "phone": "+1 (555) 024-5512",
        "street": "450 Industrial Blvd",
        "city": "Chicago",
        "country_id": type("Country", (), {"id": 1, "name": "United States"})(),
        "credit_limit": 30000.0,
        "total_invoiced": 8500.0,
        "is_company": True,
    })

    nova = Partner.create({
        "id": 3,
        "name": "Nova Retail",
        "email": "orders@novaretail.example.com",
        "phone": "+1 (555) 038-7744",
        "street": "789 Commerce St",
        "city": "New York",
        "country_id": type("Country", (), {"id": 1, "name": "United States"})(),
        "credit_limit": 15000.0,
        "total_invoiced": 4000.0,
        "is_company": True,
    })

    # 2. Product Categories
    cat_hw = Category.create({"id": 1, "name": "Hardware"})
    cat_srv = Category.create({"id": 2, "name": "Service"})
    cat_sub = Category.create({"id": 3, "name": "Subscription"})

    # 3. Products
    laptop = Product.create({
        "id": 1,
        "name": "Laptop",
        "default_code": "LAPTOP-01",
        "categ_id": cat_hw,
        "list_price": 1200.0,
        "standard_price": 800.0,
        "type": "consu",
        "qty_available": 15.0,
        "free_qty": 15.0,
        "is_recurring": False,
        "dealflow_is_recurring": False,
    })

    monitor = Product.create({
        "id": 2,
        "name": "Monitor",
        "default_code": "MON-01",
        "categ_id": cat_hw,
        "list_price": 300.0,
        "standard_price": 180.0,
        "type": "consu",
        "qty_available": 30.0,
        "free_qty": 30.0,
        "is_recurring": False,
        "dealflow_is_recurring": False,
    })

    docking = Product.create({
        "id": 3,
        "name": "Docking Station",
        "default_code": "DOCK-01",
        "categ_id": cat_hw,
        "list_price": 150.0,
        "standard_price": 80.0,
        "type": "consu",
        "qty_available": 40.0,
        "free_qty": 40.0,
        "is_recurring": False,
        "dealflow_is_recurring": False,
    })

    impl_srv = Product.create({
        "id": 4,
        "name": "Implementation Service",
        "default_code": "SRV-IMPL",
        "categ_id": cat_srv,
        "list_price": 150.0,
        "standard_price": 90.0,
        "type": "service",
        "is_recurring": False,
        "dealflow_is_recurring": False,
    })

    support = Product.create({
        "id": 5,
        "name": "Premium Support",
        "default_code": "SUB-PREM",
        "categ_id": cat_sub,
        "list_price": 500.0,
        "standard_price": 250.0,
        "type": "service",
        "is_recurring": True,
        "dealflow_is_recurring": True,
        "dealflow_recurring_interval": "month",
        "recurring_interval": "month",
    })

    warranty = Product.create({
        "id": 6,
        "name": "Extended Warranty",
        "default_code": "SRV-WARR",
        "categ_id": cat_srv,
        "list_price": 250.0,
        "standard_price": 100.0,
        "type": "service",
        "is_recurring": False,
        "dealflow_is_recurring": False,
    })

    # 4. Warehouses
    wh1 = Warehouse.create({
        "id": 1,
        "name": "WH1 Main",
        "code": "WH1",
        "sequence": 1,
        "active": True,
        "out_type_id": type("PickingType", (), {
            "id": 1,
            "warehouse_id": type("WH", (), {"id": 1, "name": "WH1 Main"})(),
            "default_location_src_id": type("Loc", (), {"id": 10})(),
        })(),
        "lot_stock_id": type("Loc", (), {"id": 10})(),
    })

    wh2 = Warehouse.create({
        "id": 2,
        "name": "WH2 East",
        "code": "WH2",
        "sequence": 2,
        "active": True,
        "out_type_id": type("PickingType", (), {
            "id": 2,
            "warehouse_id": type("WH", (), {"id": 2, "name": "WH2 East"})(),
            "default_location_src_id": type("Loc", (), {"id": 20})(),
        })(),
        "lot_stock_id": type("Loc", (), {"id": 20})(),
    })

    # 5. Inventory Stock: Laptop 9 in WH1 and 6 in WH2 (Total = 15)
    Quant.create({"id": 1, "product_id": laptop, "location_id": type("L", (), {"id": 10, "usage": "internal", "warehouse_id": wh1})(), "quantity": 9.0, "reserved_quantity": 0.0})
    Quant.create({"id": 2, "product_id": laptop, "location_id": type("L", (), {"id": 20, "usage": "internal", "warehouse_id": wh2})(), "quantity": 6.0, "reserved_quantity": 0.0})
    Quant.create({"id": 3, "product_id": monitor, "location_id": type("L", (), {"id": 10, "usage": "internal", "warehouse_id": wh1})(), "quantity": 20.0, "reserved_quantity": 0.0})
    Quant.create({"id": 4, "product_id": monitor, "location_id": type("L", (), {"id": 20, "usage": "internal", "warehouse_id": wh2})(), "quantity": 10.0, "reserved_quantity": 0.0})

    return {
        "customers": {"acme": acme, "beta": beta, "nova": nova},
        "categories": {"hardware": cat_hw, "service": cat_srv, "subscription": cat_sub},
        "products": {
            "laptop": laptop,
            "monitor": monitor,
            "docking": docking,
            "impl_srv": impl_srv,
            "support": support,
            "warranty": warranty,
        },
        "warehouses": {"wh1": wh1, "wh2": wh2},
    }


# =============================================================================
# PYTEST FIXTURES
# =============================================================================

@pytest.fixture
def mock_odoo_env() -> MockEnvironment:
    """Fixture providing an isolated high-fidelity mock Odoo environment preloaded with seed data."""
    env = MockEnvironment()
    load_seed_data(env)
    return env


@pytest.fixture
def seed_data(mock_odoo_env: MockEnvironment) -> Dict[str, Any]:
    """Fixture returning reference dictionaries to loaded seed records."""
    return {
        "customers": {
            "acme": mock_odoo_env["res.partner"].browse(1),
            "beta": mock_odoo_env["res.partner"].browse(2),
            "nova": mock_odoo_env["res.partner"].browse(3),
        },
        "products": {
            "laptop": mock_odoo_env["product.product"].browse(1),
            "monitor": mock_odoo_env["product.product"].browse(2),
            "docking": mock_odoo_env["product.product"].browse(3),
            "impl_srv": mock_odoo_env["product.product"].browse(4),
            "support": mock_odoo_env["product.product"].browse(5),
            "warranty": mock_odoo_env["product.product"].browse(6),
        },
        "warehouses": {
            "wh1": mock_odoo_env["stock.warehouse"].browse(1),
            "wh2": mock_odoo_env["stock.warehouse"].browse(2),
        },
    }


@pytest.fixture
def event_dispatcher() -> EventDispatcher:
    """Fixture providing a clean EventDispatcher instance with empty history."""
    return EventDispatcher(webhook_urls=[])


@pytest.fixture
def sales_adapter(mock_odoo_env: MockEnvironment) -> SalesAdapter:
    """Fixture providing SalesAdapter connected to the mock Odoo environment."""
    return SalesAdapter(env=mock_odoo_env)


@pytest.fixture
def inventory_adapter(mock_odoo_env: MockEnvironment) -> InventoryAdapter:
    """Fixture providing InventoryAdapter configured for multi-warehouse fulfillment."""
    adapter = InventoryAdapter(env=mock_odoo_env)
    adapter.seed_inventory(
        product_id=1,
        warehouse_stocks={
            1: {"qty_available": 9.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            2: {"qty_available": 6.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
        },
    )
    return adapter


@pytest.fixture
def subscription_adapter(mock_odoo_env: MockEnvironment) -> SubscriptionAdapter:
    """Fixture providing SubscriptionAdapter for mixed recurring / one-time analysis."""
    return SubscriptionAdapter(env=mock_odoo_env)


@pytest.fixture
def accounting_adapter(mock_odoo_env: MockEnvironment) -> AccountingAdapter:
    """Fixture providing AccountingAdapter for invoice creation and payment tracking."""
    return AccountingAdapter(env=mock_odoo_env)


@pytest.fixture
def integration_service(
    mock_odoo_env: MockEnvironment,
    sales_adapter: SalesAdapter,
    inventory_adapter: InventoryAdapter,
    subscription_adapter: SubscriptionAdapter,
    accounting_adapter: AccountingAdapter,
    event_dispatcher: EventDispatcher,
) -> OdooIntegrationService:
    """Fixture providing fully composed OdooIntegrationService."""
    return OdooIntegrationService(
        env=mock_odoo_env,
        sales_adapter=sales_adapter,
        inventory_adapter=inventory_adapter,
        subscription_adapter=subscription_adapter,
        accounting_adapter=accounting_adapter,
        event_dispatcher=event_dispatcher,
        actor="Test Admin",
        actor_id=1,
    )


@pytest.fixture
def sample_quotation(mock_odoo_env: MockEnvironment, seed_data: Dict[str, Any]) -> MockSaleOrder:
    """Creates a realistic mixed quotation (SO0001): Acme Corp, 1x Laptop ($1200), 1x Premium Support ($500/mo)."""
    SaleOrder = mock_odoo_env["sale.order"]
    SaleOrderLine = mock_odoo_env["sale.order.line"]

    acme = seed_data["customers"]["acme"]
    laptop = seed_data["products"]["laptop"]
    support = seed_data["products"]["support"]

    order = SaleOrder.create({
        "id": 1,
        "name": "SO0001",
        "partner_id": acme,
        "partner_shipping_id": acme,
        "state": "draft",
        "date_order": "2026-09-05 10:00:00",
        "dealflow_deal_id": "DEAL-ACME-001",
        "dealflow_approval_state": APPROVAL_STATE_DRAFT,
        "dealflow_risk_score": 5.0,
        "dealflow_health_status": HEALTH_STATUS_HEALTHY,
        "dealflow_locked": False,
        "amount_untaxed": 1700.0,
        "amount_tax": 170.0,
        "amount_total": 1870.0,
        "note": "Standard DealFlow quote",
    })

    line1 = SaleOrderLine.create({
        "id": 1,
        "order_id": order,
        "product_id": laptop,
        "name": "Laptop",
        "product_uom_qty": 1.0,
        "price_unit": 1200.0,
        "discount": 0.0,
        "price_subtotal": 1200.0,
        "dealflow_cost_price": 800.0,
        "dealflow_is_recurring": False,
    })

    line2 = SaleOrderLine.create({
        "id": 2,
        "order_id": order,
        "product_id": support,
        "name": "Premium Support",
        "product_uom_qty": 1.0,
        "price_unit": 500.0,
        "discount": 0.0,
        "price_subtotal": 500.0,
        "dealflow_cost_price": 250.0,
        "dealflow_is_recurring": True,
        "dealflow_recurring_interval": "month",
    })

    order.order_line = MockRecordSet([line1, line2], "sale.order.line")
    order._compute_blended_discount()

    return order
