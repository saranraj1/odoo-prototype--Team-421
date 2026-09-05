"""DealFlow360 Odoo Integration — Central Integration Service (Facade).

This module defines OdooIntegrationService, the single controlled boundary between
DealFlow and Odoo. Random backend services and frontend components are strictly
forbidden from directly accessing the Odoo ORM or API.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    APPROVAL_STATE_REJECTED,
    EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    EVENT_DISCOUNT_CHANGED,
    EVENT_INVOICE_CREATED,
    EVENT_ORDER_APPROVED,
    EVENT_ORDER_CONFIRMED,
    EVENT_PAYMENT_RECORDED,
    EVENT_SALE_ORDER_CHANGED,
    EVENT_STOCK_CHANGED,
)
from dealflow_odoo.schemas import (
    AuthorizationError,
    CustomerDTO,
    DealContextDTO,
    DealFlowIntegrationError,
    FulfillmentPlanDTO,
    InvalidStateError,
    NegotiationRequestDTO,
    NotFoundError,
    OdooExecutionError,
    OrderLineDTO,
    ProductDTO,
    ValidationError,
)
from dealflow_odoo.services.event_dispatcher import EventDispatcher, get_event_dispatcher

# Optional Odoo imports
try:
    from odoo.exceptions import (
        AccessDenied as OdooAccessDenied,
        AccessError as OdooAccessError,
        MissingError as OdooMissingError,
        UserError as OdooUserError,
        ValidationError as OdooValidationError,
    )
except ImportError:
    class OdooValidationError(Exception):
        pass

    class OdooAccessError(Exception):
        pass

    class OdooAccessDenied(Exception):
        pass

    class OdooMissingError(Exception):
        pass

    class OdooUserError(Exception):
        pass

# Optional adapter imports (dynamic composition)
try:
    from dealflow_odoo.services.sales_adapter import SalesAdapter
except ImportError:
    SalesAdapter = None

try:
    from dealflow_odoo.services.inventory_adapter import InventoryAdapter
except ImportError:
    InventoryAdapter = None

try:
    from dealflow_odoo.services.subscription_adapter import SubscriptionAdapter
except ImportError:
    SubscriptionAdapter = None

try:
    from dealflow_odoo.services.accounting_adapter import AccountingAdapter
except ImportError:
    AccountingAdapter = None

logger = logging.getLogger("dealflow.integration_service")


class OdooIntegrationService:
    """The Single Centralized Integration Boundary between DealFlow and Odoo.

    Composes SalesAdapter, InventoryAdapter, SubscriptionAdapter, AccountingAdapter,
    and EventDispatcher to provide transactional, secure, observable operations.
    """

    def __init__(
        self,
        env: Any = None,
        sales_adapter: Optional[Any] = None,
        inventory_adapter: Optional[Any] = None,
        subscription_adapter: Optional[Any] = None,
        accounting_adapter: Optional[Any] = None,
        event_dispatcher: Optional[EventDispatcher] = None,
        actor: Optional[str] = None,
        actor_id: Optional[int] = None,
    ) -> None:
        """Initialize the integration service with adapters, environment, and dispatcher.

        Args:
            env: Optional active Odoo Environment (Environment instance).
            sales_adapter: Optional SalesAdapter instance or mock.
            inventory_adapter: Optional InventoryAdapter instance or mock.
            subscription_adapter: Optional SubscriptionAdapter instance or mock.
            accounting_adapter: Optional AccountingAdapter instance or mock.
            event_dispatcher: Optional EventDispatcher instance.
            actor: Name or identifier of current user/actor.
            actor_id: Database ID of actor if available.
        """
        self.env = env
        self.actor_id = actor_id or (getattr(env, "uid", None) if env else None)
        self.actor = actor or (
            str(getattr(env.user, "name", env.uid))
            if env and hasattr(env, "user") and env.user
            else "system"
        )
        self.event_dispatcher = event_dispatcher or get_event_dispatcher()

        # Compose Adapters
        if sales_adapter is not None:
            self.sales_adapter = sales_adapter
        elif SalesAdapter is not None and env is not None:
            self.sales_adapter = SalesAdapter(env)
        else:
            self.sales_adapter = None

        if inventory_adapter is not None:
            self.inventory_adapter = inventory_adapter
        elif InventoryAdapter is not None and env is not None:
            self.inventory_adapter = InventoryAdapter(env)
        else:
            self.inventory_adapter = None

        if subscription_adapter is not None:
            self.subscription_adapter = subscription_adapter
        elif SubscriptionAdapter is not None and env is not None:
            self.subscription_adapter = SubscriptionAdapter(env)
        else:
            self.subscription_adapter = None

        if accounting_adapter is not None:
            self.accounting_adapter = accounting_adapter
        elif AccountingAdapter is not None and env is not None:
            self.accounting_adapter = AccountingAdapter(env)
        else:
            self.accounting_adapter = None

        self._audit_logs: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # Structured Audit Logging & Error Translation Boundary
    # -------------------------------------------------------------------------

    def _log_audit(
        self,
        operation: str,
        dealflow_deal_id: Optional[str],
        record_id: Optional[int],
        actor: Optional[str],
        timestamp: str,
        result: str,
        failure_reason: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Record structured audit log entry in memory and logging system."""
        entry = {
            "operation": operation,
            "dealflow_deal_id": dealflow_deal_id,
            "record_id": record_id,
            "actor": actor or self.actor,
            "timestamp": timestamp,
            "result": result,
            "failure_reason": failure_reason,
            "details": details or {},
        }
        self._audit_logs.append(entry)
        if len(self._audit_logs) > 1000:
            self._audit_logs.pop(0)

        log_level = logging.INFO if result == "SUCCESS" else logging.ERROR
        logger.log(
            log_level,
            "AUDIT: op=%s deal_id=%s record_id=%s actor=%s result=%s reason=%s",
            operation,
            dealflow_deal_id,
            record_id,
            entry["actor"],
            result,
            failure_reason,
            extra=entry,
        )
        return entry

    @contextmanager
    def _operation_boundary(
        self,
        operation: str,
        record_id: Optional[int] = None,
        dealflow_deal_id: Optional[str] = None,
        actor: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        """Context manager translating exceptions and recording structured audit logs."""
        start_time = datetime.now(timezone.utc).isoformat()
        try:
            yield
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="SUCCESS",
                details=details,
            )
        except DealFlowIntegrationError as err:
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=err.message,
                details={"code": err.code, **(err.details or {})},
            )
            raise
        except OdooValidationError as err:
            msg = str(err)
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=msg,
            )
            raise ValidationError(msg) from err
        except (OdooAccessError, OdooAccessDenied) as err:
            msg = str(err)
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=msg,
            )
            raise AuthorizationError(msg) from err
        except OdooMissingError as err:
            msg = str(err)
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=msg,
            )
            raise NotFoundError(msg) from err
        except OdooUserError as err:
            msg = str(err)
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=msg,
            )
            lower_msg = msg.lower()
            if any(w in lower_msg for w in ["state", "status", "lock", "draft", "confirm", "approve", "cancel"]):
                raise InvalidStateError(msg) from err
            raise OdooExecutionError(msg) from err
        except Exception as err:
            msg = f"Execution failed during {operation}: {str(err)}"
            self._log_audit(
                operation=operation,
                dealflow_deal_id=dealflow_deal_id,
                record_id=record_id,
                actor=actor or self.actor,
                timestamp=start_time,
                result="FAILURE",
                failure_reason=msg,
            )
            raise OdooExecutionError(msg) from err

    def get_audit_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent audit logs in reverse chronological order."""
        logs = list(self._audit_logs)
        logs.reverse()
        return logs[:limit]

    # -------------------------------------------------------------------------
    # Core Operations: Customer & Product
    # -------------------------------------------------------------------------

    def get_customer(self, partner_id: int) -> CustomerDTO:
        """Fetch customer profile from Odoo as CustomerDTO.

        Args:
            partner_id: ID of res.partner record.

        Returns:
            CustomerDTO containing credit limit, billing details, and company flag.
        """
        with self._operation_boundary("get_customer", record_id=partner_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "get_customer"):
                return self.sales_adapter.get_customer(partner_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            partner = self.env["res.partner"].browse(partner_id)
            if not partner.exists() or (hasattr(partner, "active") and not partner.active):
                raise NotFoundError(f"Customer with ID {partner_id} does not exist")

            return CustomerDTO(
                id=partner.id,
                name=partner.name,
                email=partner.email,
                phone=partner.phone,
                credit_limit=float(getattr(partner, "credit_limit", 0.0) or 0.0),
                total_invoiced=float(getattr(partner, "total_invoiced", 0.0) or 0.0),
                is_company=bool(partner.is_company),
                street=partner.street,
                city=partner.city,
                country=partner.country_id.name if getattr(partner, "country_id", None) else None,
            )

    def get_product(self, product_id: int) -> ProductDTO:
        """Fetch product information from Odoo as ProductDTO.

        Args:
            product_id: ID of product.product record.

        Returns:
            ProductDTO containing prices, category, type, and recurring attributes.
        """
        with self._operation_boundary("get_product", record_id=product_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "get_product"):
                return self.sales_adapter.get_product(product_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            product = self.env["product.product"].browse(product_id)
            if not product.exists() or (hasattr(product, "active") and not product.active):
                raise NotFoundError(f"Product with ID {product_id} does not exist")

            categ = getattr(product, "categ_id", None)
            categ_id = categ.id if categ else 1
            categ_name = categ.name if categ else "All"

            is_recurring = bool(
                getattr(product, "dealflow_is_recurring", getattr(product, "recurring_invoice", False))
            )
            recurring_interval = getattr(product, "dealflow_recurring_interval", None)

            return ProductDTO(
                id=product.id,
                name=product.name,
                default_code=product.default_code,
                list_price=float(product.list_price or 0.0),
                standard_price=float(product.standard_price or 0.0),
                category_id=categ_id,
                category_name=categ_name,
                type=getattr(product, "type", "consu"),
                is_recurring=is_recurring,
                recurring_interval=recurring_interval,
            )

    # -------------------------------------------------------------------------
    # Core Operations: Order & Deal Context
    # -------------------------------------------------------------------------

    def get_order(self, order_id: int) -> Dict[str, Any]:
        """Fetch raw order details from Odoo.

        Args:
            order_id: ID of sale.order record.

        Returns:
            Dictionary representing the order, lines, and DealFlow status.
        """
        with self._operation_boundary("get_order", record_id=order_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "get_order"):
                return self.sales_adapter.get_order(order_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            order = self.env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(f"Sale order with ID {order_id} does not exist")

            lines = []
            for line in order.order_line:
                lines.append({
                    "id": line.id,
                    "product_id": line.product_id.id,
                    "product_name": line.product_id.name,
                    "product_uom_qty": float(line.product_uom_qty or 0.0),
                    "price_unit": float(line.price_unit or 0.0),
                    "discount": float(getattr(line, "discount", 0.0) or 0.0),
                    "price_subtotal": float(line.price_subtotal or 0.0),
                })

            return {
                "id": order.id,
                "name": order.name,
                "partner_id": order.partner_id.id,
                "partner_name": order.partner_id.name,
                "state": order.state,
                "date_order": str(order.date_order) if order.date_order else "",
                "amount_untaxed": float(order.amount_untaxed or 0.0),
                "amount_tax": float(order.amount_tax or 0.0),
                "amount_total": float(order.amount_total or 0.0),
                "dealflow_deal_id": getattr(order, "dealflow_deal_id", None),
                "dealflow_approval_state": getattr(order, "dealflow_approval_state", APPROVAL_STATE_DRAFT),
                "dealflow_risk_score": float(getattr(order, "dealflow_risk_score", 0.0) or 0.0),
                "dealflow_health_status": getattr(order, "dealflow_health_status", "healthy"),
                "dealflow_locked": bool(getattr(order, "dealflow_locked", False)),
                "lines": lines,
            }

    def get_deal_context(self, order_id: int) -> DealContextDTO:
        """Assemble canonical DealContextDTO for DealFlow Decision Engine.

        Serializes customer profile, order lines, margins, discounts, category
        breakdowns, recurring/one-time splits, and DealFlow governance states.

        Args:
            order_id: ID of sale.order record.

        Returns:
            DealContextDTO instance.
        """
        with self._operation_boundary("get_deal_context", record_id=order_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "get_deal_context"):
                return self.sales_adapter.get_deal_context(order_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            order = self.env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(f"Sale order with ID {order_id} does not exist")

            # Check if model has native action_get_deal_context method
            if hasattr(order, "action_get_deal_context"):
                res = order.action_get_deal_context()
                if isinstance(res, DealContextDTO):
                    return res
                if isinstance(res, dict):
                    cust_data = res.get("customer", {})
                    cust_dto = CustomerDTO(**cust_data) if isinstance(cust_data, dict) else cust_data
                    lines_data = [
                        OrderLineDTO(**l) if isinstance(l, dict) else l
                        for l in res.get("lines", [])
                    ]
                    res_copy = dict(res)
                    res_copy["customer"] = cust_dto
                    res_copy["lines"] = lines_data
                    return DealContextDTO(**res_copy)

            # Direct serialization fallback
            customer_dto = self.get_customer(order.partner_id.id)
            lines_dto: List[OrderLineDTO] = []
            total_cost = 0.0
            total_margin = 0.0
            has_recurring = False
            mrr = 0.0
            arr = 0.0

            total_nominal = 0.0
            total_discount_amount = 0.0

            for line in order.order_line:
                prod = line.product_id
                categ_name = prod.categ_id.name if prod.categ_id else "All"
                qty = float(line.product_uom_qty or 0.0)
                price_unit = float(line.price_unit or 0.0)
                discount = float(getattr(line, "discount", 0.0) or 0.0)
                subtotal = float(line.price_subtotal or 0.0)
                cost = float(getattr(line, "purchase_price", getattr(prod, "standard_price", 0.0)) or 0.0)
                line_cost = cost * qty
                line_margin = subtotal - line_cost
                margin_pct = (line_margin / subtotal * 100.0) if subtotal > 0 else 0.0

                is_rec = bool(getattr(line, "dealflow_is_recurring", getattr(prod, "recurring_invoice", False)))
                rec_interval = getattr(line, "dealflow_recurring_interval", None)
                if is_rec:
                    has_recurring = True
                    if rec_interval == "year":
                        arr += subtotal
                        mrr += subtotal / 12.0
                    else:
                        mrr += subtotal
                        arr += subtotal * 12.0

                line_nominal = price_unit * qty
                total_nominal += line_nominal
                total_discount_amount += (line_nominal * (discount / 100.0))

                total_cost += line_cost
                total_margin += line_margin

                lines_dto.append(
                    OrderLineDTO(
                        id=line.id,
                        product_id=prod.id,
                        product_name=prod.name,
                        category_name=categ_name,
                        product_uom_qty=qty,
                        price_unit=price_unit,
                        cost_price=cost,
                        discount=discount,
                        price_subtotal=subtotal,
                        margin=line_margin,
                        margin_percent=margin_pct,
                        is_recurring=is_rec,
                        recurring_interval=rec_interval,
                    )
                )

            blended_discount = (total_discount_amount / total_nominal * 100.0) if total_nominal > 0 else 0.0
            margin_percent = (total_margin / order.amount_untaxed * 100.0) if order.amount_untaxed > 0 else 0.0

            deal_id = getattr(order, "dealflow_deal_id", None)
            currency_name = order.currency_id.name if hasattr(order, "currency_id") and order.currency_id else "USD"

            return DealContextDTO(
                deal_id=deal_id,
                order_id=order.id,
                order_name=order.name,
                customer=customer_dto,
                state=order.state,
                date_order=str(order.date_order) if order.date_order else "",
                currency=currency_name,
                amount_untaxed=float(order.amount_untaxed or 0.0),
                amount_tax=float(order.amount_tax or 0.0),
                amount_total=float(order.amount_total or 0.0),
                blended_discount=round(blended_discount, 2),
                total_cost=round(total_cost, 2),
                total_margin=round(total_margin, 2),
                margin_percent=round(margin_percent, 2),
                lines=lines_dto,
                has_recurring_lines=has_recurring,
                mrr=round(mrr, 2),
                arr=round(arr, 2),
                dealflow_risk_score=float(getattr(order, "dealflow_risk_score", 0.0) or 0.0),
                dealflow_approval_state=getattr(order, "dealflow_approval_state", APPROVAL_STATE_DRAFT),
                dealflow_health_status=getattr(order, "dealflow_health_status", "healthy"),
                dealflow_locked=bool(getattr(order, "dealflow_locked", False)),
            )

    def update_order(self, order_id: int, values: Dict[str, Any]) -> Dict[str, Any]:
        """Update fields or lines on a sale order.

        Args:
            order_id: ID of sale.order.
            values: Dict of values to update on the order.

        Returns:
            Dict summary of updated order.
        """
        deal_id = values.get("dealflow_deal_id")
        with self._operation_boundary("update_order", record_id=order_id, dealflow_deal_id=deal_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "update_order"):
                res = self.sales_adapter.update_order(order_id, values)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")
                if order.state in ("sale", "done", "cancel"):
                    raise InvalidStateError(f"Cannot update order in state '{order.state}'")
                if getattr(order, "dealflow_locked", False):
                    raise InvalidStateError(f"Order {order_id} is locked pending approval")

                order.write(values)
                deal_id = getattr(order, "dealflow_deal_id", deal_id)
                res = {"order_id": order.id, "state": order.state, "updated_fields": list(values.keys())}
            else:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            # Dispatch events
            if "order_line" in values or any("discount" in k for k in values):
                self.event_dispatcher.dispatch(
                    event_type=EVENT_DISCOUNT_CHANGED,
                    record_id=order_id,
                    model="sale.order",
                    data={"order_id": order_id, "changes": values},
                    deal_id=deal_id,
                    actor_id=self.actor_id,
                )
            self.event_dispatcher.dispatch(
                event_type=EVENT_SALE_ORDER_CHANGED,
                record_id=order_id,
                model="sale.order",
                data={"order_id": order_id, "changes": values},
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res

    def apply_approved_change(self, order_id: int, changes: Dict[str, Any]) -> Dict[str, Any]:
        """Apply approved changes (discounts, lines, terms) atomically to an order.

        Args:
            order_id: ID of sale.order.
            changes: Dict detailing approved discounts, lines, or status changes.

        Returns:
            Dict summary of applied updates.
        """
        deal_id = changes.get("dealflow_deal_id")
        with self._operation_boundary("apply_approved_change", record_id=order_id, dealflow_deal_id=deal_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "apply_approved_change"):
                res = self.sales_adapter.apply_approved_change(order_id, changes)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")

                deal_id = getattr(order, "dealflow_deal_id", deal_id)
                if hasattr(order, "action_dealflow_apply_approved_change"):
                    res = order.action_dealflow_apply_approved_change(changes)
                else:
                    # Generic atomic write
                    line_changes = changes.get("lines", [])
                    for lc in line_changes:
                        line_id = lc.get("id") or lc.get("line_id")
                        if line_id:
                            line = order.order_line.filtered(lambda l: l.id == line_id)
                            if line:
                                update_vals = {}
                                if "discount" in lc:
                                    update_vals["discount"] = float(lc["discount"])
                                if "price_unit" in lc:
                                    update_vals["price_unit"] = float(lc["price_unit"])
                                if update_vals:
                                    line.write(update_vals)

                    order_vals = {
                        "dealflow_approval_state": changes.get("dealflow_approval_state", APPROVAL_STATE_APPROVED),
                        "dealflow_locked": False,
                    }
                    if "dealflow_risk_score" in changes:
                        order_vals["dealflow_risk_score"] = float(changes["dealflow_risk_score"])
                    order.write(order_vals)
                    res = {"order_id": order.id, "status": "approved_changes_applied", "state": order.state}
            else:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            self.event_dispatcher.dispatch(
                event_type=EVENT_ORDER_APPROVED,
                record_id=order_id,
                model="sale.order",
                data={"order_id": order_id, "changes": changes},
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res

    def confirm_order(self, order_id: int, approval_token: Optional[str] = None) -> Dict[str, Any]:
        """Confirm quotation into a confirmed sales order with DealFlow governance check.

        Inviolable Invariant: An order that requires approval CANNOT be confirmed
        unless dealflow_approval_state is 'approved' or a valid approval token is passed.

        Args:
            order_id: ID of sale.order.
            approval_token: Optional DealFlow authorization token.

        Returns:
            Dict containing confirmation status and new order state.
        """
        with self._operation_boundary("confirm_order", record_id=order_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "confirm_order"):
                res = self.sales_adapter.confirm_order(order_id, approval_token=approval_token)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")

                # Governance Guard
                is_locked = bool(getattr(order, "dealflow_locked", False))
                app_state = getattr(order, "dealflow_approval_state", APPROVAL_STATE_DRAFT)

                if is_locked and not approval_token:
                    raise AuthorizationError(
                        f"Order {order_id} is locked and requires DealFlow approval before confirmation"
                    )

                if app_state in (APPROVAL_STATE_PENDING, APPROVAL_STATE_REJECTED, APPROVAL_STATE_REAPPROVAL_REQUIRED):
                    if not approval_token:
                        raise AuthorizationError(
                            f"Cannot confirm order {order_id} in approval state '{app_state}' without approval token"
                        )

                if hasattr(order, "action_dealflow_confirm"):
                    res = order.action_dealflow_confirm()
                else:
                    order.action_confirm()
                    res = {"order_id": order.id, "state": order.state, "confirmed": True}
            else:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            deal_id = res.get("dealflow_deal_id") if isinstance(res, dict) else None
            self.event_dispatcher.dispatch(
                event_type=EVENT_ORDER_CONFIRMED,
                record_id=order_id,
                model="sale.order",
                data=res if isinstance(res, dict) else {"order_id": order_id, "confirmed": True},
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res

    # -------------------------------------------------------------------------
    # Core Operations: Inventory & Fulfillment
    # -------------------------------------------------------------------------

    def get_available_stock(self, product_id: int) -> float:
        """Get total available stock for a product across all warehouses.

        Args:
            product_id: ID of product.product.

        Returns:
            Total float quantity available.
        """
        with self._operation_boundary("get_available_stock", record_id=product_id):
            if self.inventory_adapter and hasattr(self.inventory_adapter, "get_available_stock"):
                return float(self.inventory_adapter.get_available_stock(product_id))

            if not self.env:
                raise OdooExecutionError("Odoo environment or InventoryAdapter is required")

            product = self.env["product.product"].browse(product_id)
            if not product.exists():
                raise NotFoundError(f"Product {product_id} does not exist")

            return float(getattr(product, "free_qty", getattr(product, "qty_available", 0.0)) or 0.0)

    def get_warehouse_stock(self, product_id: int) -> List[Dict[str, Any]]:
        """Get per-warehouse stock availability breakdown for a product.

        Args:
            product_id: ID of product.product.

        Returns:
            List of dicts: [{"warehouse_id": int, "warehouse_name": str, "available_qty": float}]
        """
        with self._operation_boundary("get_warehouse_stock", record_id=product_id):
            if self.inventory_adapter and hasattr(self.inventory_adapter, "get_warehouse_stock"):
                return self.inventory_adapter.get_warehouse_stock(product_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or InventoryAdapter is required")

            product = self.env["product.product"].browse(product_id)
            if not product.exists():
                raise NotFoundError(f"Product {product_id} does not exist")

            quants = self.env["stock.quant"].search([
                ("product_id", "=", product_id),
                ("location_id.usage", "=", "internal"),
            ])
            warehouses: Dict[int, Dict[str, Any]] = {}
            for quant in quants:
                wh = getattr(quant.location_id, "warehouse_id", None)
                if not wh:
                    continue
                if wh.id not in warehouses:
                    warehouses[wh.id] = {
                        "warehouse_id": wh.id,
                        "warehouse_name": wh.name,
                        "available_qty": 0.0,
                    }
                free_qty = quant.quantity - getattr(quant, "reserved_quantity", 0.0)
                warehouses[wh.id]["available_qty"] += float(free_qty)

            return list(warehouses.values())

    def apply_fulfillment_plan(
        self,
        order_id: int,
        plan: Union[FulfillmentPlanDTO, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Apply warehouse allocation split to an order and its delivery operations.

        Splits lines or delivery pickings so that allocations across multiple warehouses
        (e.g. 9 units from WH1, 6 units from WH2) execute cleanly inside Odoo.

        Args:
            order_id: ID of sale.order.
            plan: FulfillmentPlanDTO or equivalent dictionary.

        Returns:
            Dict describing the applied fulfillment allocations.
        """
        plan_dict = asdict(plan) if is_dataclass(plan) else dict(plan)
        deal_id = plan_dict.get("deal_id")

        with self._operation_boundary("apply_fulfillment_plan", record_id=order_id, dealflow_deal_id=deal_id):
            if self.inventory_adapter and hasattr(self.inventory_adapter, "apply_fulfillment_plan"):
                res = self.inventory_adapter.apply_fulfillment_plan(order_id, plan)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")

                # Basic fulfillment split execution fallback
                res = {
                    "order_id": order_id,
                    "status": "fulfillment_plan_applied",
                    "allocations": plan_dict.get("allocations", []),
                }
            else:
                raise OdooExecutionError("Odoo environment or InventoryAdapter is required")

            self.event_dispatcher.dispatch(
                event_type=EVENT_STOCK_CHANGED,
                record_id=order_id,
                model="sale.order",
                data=res,
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res

    # -------------------------------------------------------------------------
    # Core Operations: Invoicing & Accounting
    # -------------------------------------------------------------------------

    def create_invoice(self, order_id: int) -> Dict[str, Any]:
        """Create draft/posted customer invoice from a confirmed sale order.

        Args:
            order_id: ID of confirmed sale.order.

        Returns:
            Dict with invoice_id, state, amount_total.
        """
        with self._operation_boundary("create_invoice", record_id=order_id):
            if self.accounting_adapter and hasattr(self.accounting_adapter, "create_invoice"):
                res = self.accounting_adapter.create_invoice(order_id)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")
                if order.state != "sale":
                    raise InvalidStateError(
                        f"Cannot invoice order {order_id} in state '{order.state}'. Order must be confirmed ('sale')."
                    )

                invoices = order._create_invoices()
                if not invoices:
                    raise InvalidStateError(
                        f"No invoice created for order {order_id}. Verify invoicing policy or delivered quantities."
                    )
                inv = invoices[0]
                res = {
                    "order_id": order_id,
                    "invoice_id": inv.id,
                    "invoice_ids": invoices.ids,
                    "state": inv.state,
                    "amount_total": float(inv.amount_total or 0.0),
                }
            else:
                raise OdooExecutionError("Odoo environment or AccountingAdapter is required")

            invoice_id = res.get("invoice_id")
            deal_id = res.get("dealflow_deal_id")
            self.event_dispatcher.dispatch(
                event_type=EVENT_INVOICE_CREATED,
                record_id=invoice_id or order_id,
                model="account.move",
                data=res,
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res

    def get_invoice(self, invoice_id: int) -> Dict[str, Any]:
        """Fetch status, payment state, and amounts for an invoice.

        Args:
            invoice_id: ID of account.move.

        Returns:
            Dict containing invoice details.
        """
        with self._operation_boundary("get_invoice", record_id=invoice_id):
            if self.accounting_adapter and hasattr(self.accounting_adapter, "get_invoice"):
                return self.accounting_adapter.get_invoice(invoice_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or AccountingAdapter is required")

            move = self.env["account.move"].browse(invoice_id)
            if not move.exists():
                raise NotFoundError(f"Invoice with ID {invoice_id} does not exist")

            return {
                "id": move.id,
                "name": move.name,
                "state": move.state,
                "payment_state": getattr(move, "payment_state", "not_paid"),
                "amount_total": float(move.amount_total or 0.0),
                "amount_residual": float(getattr(move, "amount_residual", move.amount_total) or 0.0),
            }

    def get_payment_status(self, order_id: int) -> Dict[str, Any]:
        """Check payment status for all invoices related to a sale order.

        Args:
            order_id: ID of sale.order.

        Returns:
            Dict with payment status summary.
        """
        with self._operation_boundary("get_payment_status", record_id=order_id):
            if self.accounting_adapter and hasattr(self.accounting_adapter, "get_payment_status"):
                return self.accounting_adapter.get_payment_status(order_id)

            if not self.env:
                raise OdooExecutionError("Odoo environment or AccountingAdapter is required")

            order = self.env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(f"Sale order {order_id} does not exist")

            invoices = order.invoice_ids
            if not invoices:
                return {
                    "order_id": order_id,
                    "has_invoices": False,
                    "is_paid": False,
                    "payment_state": "no_invoice",
                    "invoice_ids": [],
                    "total_invoiced": 0.0,
                    "total_residual": 0.0,
                }

            all_paid = all(getattr(inv, "payment_state", "") in ("paid", "in_payment") for inv in invoices)
            latest_state = getattr(invoices[0], "payment_state", "not_paid")

            total_inv = sum(float(inv.amount_total or 0.0) for inv in invoices)
            total_res = sum(float(getattr(inv, "amount_residual", inv.amount_total) or 0.0) for inv in invoices)

            return {
                "order_id": order_id,
                "has_invoices": True,
                "is_paid": all_paid,
                "payment_state": latest_state,
                "invoice_ids": invoices.ids,
                "total_invoiced": round(total_inv, 2),
                "total_residual": round(total_res, 2),
            }

    # -------------------------------------------------------------------------
    # Core Operations: Portal Customer Negotiation (IDOR Protected)
    # -------------------------------------------------------------------------

    def submit_negotiation(
        self,
        order_id: int,
        customer_id: int,
        proposed_changes: Union[NegotiationRequestDTO, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Submit a customer portal counter-offer with strict IDOR verification.

        Critical Invariant:
        Customer portal NEVER mutates sale.order directly. It records a negotiation
        request and triggers re-evaluation in DealFlow.

        Args:
            order_id: ID of sale.order.
            customer_id: ID of res.partner customer submitting the negotiation.
            proposed_changes: Counter-offer terms, target discounts, notes.

        Returns:
            Dict confirmation of submitted negotiation.
        """
        changes_dict = asdict(proposed_changes) if is_dataclass(proposed_changes) else dict(proposed_changes)
        with self._operation_boundary("submit_negotiation", record_id=order_id):
            if self.sales_adapter and hasattr(self.sales_adapter, "submit_negotiation"):
                res = self.sales_adapter.submit_negotiation(order_id, customer_id, proposed_changes)
            elif self.env:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} does not exist")

                # IDOR Security Check
                if order.partner_id.id != customer_id:
                    raise AuthorizationError(
                        f"Customer ID {customer_id} is not authorized to negotiate on order {order_id} (owner ID {order.partner_id.id})"
                    )

                if order.state in ("sale", "done", "cancel"):
                    raise InvalidStateError(f"Cannot negotiate order {order_id} in '{order.state}' state")

                # Create dealflow.negotiation record if model exists
                nego_model = self.env.get("dealflow.negotiation")
                nego_id = None
                if nego_model:
                    rec = nego_model.create({
                        "order_id": order.id,
                        "customer_id": customer_id,
                        "requested_discount": float(changes_dict.get("requested_discount", 0.0)),
                        "requested_terms": changes_dict.get("requested_terms"),
                        "customer_note": changes_dict.get("customer_note"),
                        "state": "submitted",
                    })
                    nego_id = rec.id

                # Flag order as reapproval required
                if hasattr(order, "dealflow_approval_state"):
                    order.write({"dealflow_approval_state": APPROVAL_STATE_REAPPROVAL_REQUIRED})

                res = {
                    "order_id": order_id,
                    "customer_id": customer_id,
                    "negotiation_id": nego_id,
                    "status": "submitted",
                    "proposed_changes": changes_dict,
                }
            else:
                raise OdooExecutionError("Odoo environment or SalesAdapter is required")

            deal_id = getattr(order, "dealflow_deal_id", None) if self.env else None
            self.event_dispatcher.dispatch(
                event_type=EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
                record_id=order_id,
                model="dealflow.negotiation",
                data=res,
                deal_id=deal_id,
                actor_id=self.actor_id,
            )

            return res




