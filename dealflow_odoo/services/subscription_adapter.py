"""DealFlow360 Odoo Integration — Subscription Adapter.

Provides native Odoo subscription & hybrid billing integration:
- Hybrid/mixed order parsing (separating one-time products from recurring subscriptions)
- Calculation of MRR (Monthly Recurring Revenue), ARR (Annual Recurring Revenue), and billing intervals
- Native subscription state and renewal date tracking
- Triggering recurring subscription renewals and generating recurring invoices
"""

from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
import calendar

try:
    from dealflow_odoo.schemas import (
        DealFlowIntegrationError,
        ValidationError,
        NotFoundError,
        InvalidStateError,
        OdooExecutionError,
        OrderLineDTO,
    )
    from dealflow_odoo.constants import (
        EVENT_INVOICE_CREATED,
        ERR_VALIDATION,
        ERR_NOT_FOUND,
        ERR_INVALID_STATE,
        ERR_ODOO_FAILURE,
    )
except ImportError:
    from ..schemas import (  # type: ignore[no-redef]
        DealFlowIntegrationError,
        ValidationError,
        NotFoundError,
        InvalidStateError,
        OdooExecutionError,
        OrderLineDTO,
    )
    from ..constants import (  # type: ignore[no-redef]
        EVENT_INVOICE_CREATED,
        ERR_VALIDATION,
        ERR_NOT_FOUND,
        ERR_INVALID_STATE,
        ERR_ODOO_FAILURE,
    )

from .accounting_adapter import AccountingAdapter


def _add_billing_period(start_date_str: str, interval: str) -> str:
    """Calculate the next renewal date based on ISO date string and interval.

    Args:
        start_date_str: Date string in 'YYYY-MM-DD' or ISO format.
        interval: 'month' or 'year'.

    Returns:
        Next date string in 'YYYY-MM-DD' format.
    """
    try:
        # Extract YYYY-MM-DD from possible datetime string
        clean_date = start_date_str.split("T")[0].split(" ")[0]
        dt = datetime.strptime(clean_date, "%Y-%m-%d")
    except Exception:
        dt = datetime.now()

    if interval == "year":
        try:
            next_dt = dt.replace(year=dt.year + 1)
        except ValueError:
            # Handle Feb 29 on leap year
            next_dt = dt.replace(year=dt.year + 1, day=28)
    else:
        # Month increment
        year = dt.year + (dt.month // 12)
        month = (dt.month % 12) + 1
        day = min(dt.day, calendar.monthrange(year, month)[1])
        next_dt = dt.replace(year=year, month=month, day=day)

    return next_dt.strftime("%Y-%m-%d")


class SubscriptionAdapter:
    """Service adapter managing subscription parsing, status, and renewal operations.

    Ensures DealFlow treats native Odoo models as the single source of subscription
    truth while orchestrating recurring metrics (MRR/ARR) and renewal actions.
    """

    def __init__(
        self,
        odoo_client: Optional[Any] = None,
        env: Optional[Any] = None,
        accounting_adapter: Optional[AccountingAdapter] = None,
    ) -> None:
        """Initialize the subscription adapter.

        Args:
            odoo_client: Optional RPC client connection to Odoo.
            env: Optional native Odoo ORM environment.
            accounting_adapter: Optional instance of AccountingAdapter to share.
        """
        self.odoo_client = odoo_client
        self.env = env
        self.accounting_adapter = accounting_adapter or AccountingAdapter(
            odoo_client=odoo_client, env=env
        )

        # In-memory storage for standalone unit tests / simulation runs
        self._mock_orders: Dict[int, Dict[str, Any]] = {}
        self._mock_subscription_metadata: Dict[int, Dict[str, Any]] = {}

    # -------------------------------------------------------------------------
    # In-Memory Test Fixture Helpers
    # -------------------------------------------------------------------------

    def register_mock_order(
        self,
        order_dict: Dict[str, Any],
        renewal_date: Optional[str] = None,
        active: bool = True,
    ) -> None:
        """Register an order with optional subscription metadata in the test store."""
        order_id = int(order_dict.get("id", order_dict.get("order_id", 0)))
        if not order_id:
            raise ValidationError("Order must contain an 'id' or 'order_id'.")

        self._mock_orders[order_id] = dict(order_dict)
        self.accounting_adapter.register_mock_order(order_dict)

        if renewal_date:
            self._mock_subscription_metadata[order_id] = {
                "renewal_date": renewal_date,
                "active": active,
            }

    # -------------------------------------------------------------------------
    # Order Parsing & Recurring Calculations
    # -------------------------------------------------------------------------

    def parse_mixed_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Separate one-time lines from recurring lines and compute MRR/ARR.

        Handles mixed orders (e.g. Laptop x 1, Monitor x 1 alongside
        Premium Support x 1 monthly) and provides exact metrics.

        Args:
            order_data: Dictionary containing order information and lines.
                        Accepts keys 'lines', 'order_line', or 'order_lines'.
                        Line items can be dictionaries or OrderLineDTO instances.

        Returns:
            Dict containing:
                one_time_lines: List of non-recurring lines.
                recurring_lines: List of recurring subscription lines.
                one_time_total: Total monetary amount for one-time products.
                recurring_mrr: Monthly Recurring Revenue.
                recurring_arr: Annual Recurring Revenue.
                billing_interval: 'month' or 'year' (or None if no recurring lines).
                has_recurring: True if recurring products exist.
                has_one_time: True if one-time products exist.
        """
        raw_lines = (
            order_data.get("lines")
            or order_data.get("order_line")
            or order_data.get("order_lines")
            or []
        )

        one_time_lines: List[Dict[str, Any]] = []
        recurring_lines: List[Dict[str, Any]] = []

        one_time_total: float = 0.0
        recurring_mrr: float = 0.0
        recurring_arr: float = 0.0
        interval_counts: Dict[str, int] = {"month": 0, "year": 0}

        for item in raw_lines:
            # Normalize item to dict if it is an OrderLineDTO or dataclass
            if hasattr(item, "__dict__") and not isinstance(item, dict):
                line = dict(item.__dict__)
            elif isinstance(item, dict):
                line = dict(item)
            else:
                continue

            # Calculate or extract line subtotal
            qty = float(line.get("product_uom_qty", line.get("quantity", 1.0)))
            price_unit = float(line.get("price_unit", 0.0))
            discount = float(line.get("discount", 0.0))

            if "price_subtotal" in line and line["price_subtotal"] is not None:
                subtotal = float(line["price_subtotal"])
            else:
                subtotal = (qty * price_unit) * (1.0 - (discount / 100.0))
            line["calculated_subtotal"] = round(subtotal, 2)

            # Determine if this line represents a recurring subscription
            is_recurring = False
            raw_interval = line.get("recurring_interval")

            if line.get("is_recurring") is True:
                is_recurring = True
            elif raw_interval in ("month", "year", "monthly", "yearly", "annual"):
                is_recurring = True
            else:
                # Check category or naming conventions
                cat_name = str(line.get("category_name", "")).lower()
                prod_name = str(line.get("product_name", line.get("name", ""))).lower()
                if "subscription" in cat_name or "subscription" in prod_name or "saas" in prod_name:
                    is_recurring = True

            if is_recurring:
                # Normalize interval to 'month' or 'year'
                prod_name_lower = str(line.get("product_name", line.get("name", ""))).lower()
                interval_str = str(raw_interval or "").lower()

                if "year" in interval_str or "annual" in interval_str or "annual" in prod_name_lower or "year" in prod_name_lower:
                    normalized_interval = "year"
                    line_mrr = subtotal / 12.0
                    line_arr = subtotal
                else:
                    normalized_interval = "month"
                    line_mrr = subtotal
                    line_arr = subtotal * 12.0

                interval_counts[normalized_interval] += 1
                recurring_mrr += line_mrr
                recurring_arr += line_arr

                line["normalized_interval"] = normalized_interval
                line["line_mrr"] = round(line_mrr, 2)
                line["line_arr"] = round(line_arr, 2)
                recurring_lines.append(line)
            else:
                one_time_total += subtotal
                one_time_lines.append(line)

        # Determine dominant billing interval
        if recurring_lines:
            billing_interval = "year" if interval_counts["year"] > interval_counts["month"] else "month"
        else:
            billing_interval = None

        order_id = order_data.get("order_id") or order_data.get("id")

        return {
            "order_id": order_id,
            "has_recurring": len(recurring_lines) > 0,
            "has_one_time": len(one_time_lines) > 0,
            "one_time_lines": one_time_lines,
            "recurring_lines": recurring_lines,
            "one_time_total": round(one_time_total, 2),
            "recurring_mrr": round(recurring_mrr, 2),
            "recurring_arr": round(recurring_arr, 2),
            "billing_interval": billing_interval,
            "total_contract_value": round(one_time_total + recurring_arr, 2),
        }

    # -------------------------------------------------------------------------
    # Subscription Status & Renewal Invoicing
    # -------------------------------------------------------------------------

    def get_subscription_status(self, order_id: int) -> Dict[str, Any]:
        """Return subscription status: active, renewal_date, recurring_interval, mrr, state.

        Args:
            order_id: The ID of the sale order.

        Returns:
            Dict containing:
                active: Boolean indicating if subscription is active.
                renewal_date: ISO date string for next renewal billing date.
                recurring_interval: 'month' or 'year'.
                mrr: Monthly Recurring Revenue.
                state: 'active', 'draft', 'closed', 'cancelled', etc.
                arr: Annual Recurring Revenue.

        Raises:
            NotFoundError: If the order cannot be found.
        """
        order_id = int(order_id)

        # 1. Native Odoo ORM execution
        if self.env is not None:
            order = self.env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

            # Parse lines using parse_mixed_order
            lines_data = []
            for line in order.order_line:
                lines_data.append({
                    "id": line.id,
                    "product_id": line.product_id.id,
                    "product_name": line.name or line.product_id.display_name,
                    "category_name": line.product_id.categ_id.name if line.product_id.categ_id else "",
                    "product_uom_qty": line.product_uom_qty,
                    "price_unit": line.price_unit,
                    "discount": line.discount,
                    "price_subtotal": line.price_subtotal,
                    "is_recurring": getattr(line.product_id, "is_recurring", False) or getattr(line, "dealflow_is_recurring", False),
                    "recurring_interval": getattr(line.product_id, "recurring_interval", None),
                })

            parsed = self.parse_mixed_order({"id": order_id, "lines": lines_data})
            mrr = parsed["recurring_mrr"]
            arr = parsed["recurring_arr"]
            interval = parsed["billing_interval"] or "month"

            # Derive subscription lifecycle state
            order_state = order.state
            if order_state in ("sale", "done") and parsed["has_recurring"]:
                sub_state = "active"
                is_active = True
            elif order_state in ("draft", "sent"):
                sub_state = "draft"
                is_active = False
            elif order_state == "cancel":
                sub_state = "cancelled"
                is_active = False
            else:
                sub_state = "inactive"
                is_active = False

            # Retrieve or calculate renewal date
            renewal_date: str
            if hasattr(order, "next_invoice_date") and order.next_invoice_date:
                renewal_date = str(order.next_invoice_date)
            else:
                date_base = str(order.date_order or datetime.now().strftime("%Y-%m-%d"))
                renewal_date = _add_billing_period(date_base, interval)

            return {
                "order_id": order_id,
                "active": is_active,
                "renewal_date": renewal_date,
                "recurring_interval": interval,
                "mrr": mrr,
                "state": sub_state,
                "arr": arr,
            }

        # 2. Odoo RPC Client execution
        if self.odoo_client is not None:
            orders = self.odoo_client.execute_kw(
                "sale.order",
                "read",
                [[order_id]],
                {"fields": ["id", "name", "state", "date_order", "order_line"]},
            )
            if not orders:
                raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

            order_data = orders[0]
            line_ids = order_data.get("order_line", [])
            lines_data = []
            if line_ids:
                lines_data = self.odoo_client.execute_kw(
                    "sale.order.line",
                    "read",
                    [line_ids],
                    {"fields": ["id", "name", "product_uom_qty", "price_unit", "discount", "price_subtotal", "product_id"]},
                )

            parsed = self.parse_mixed_order({"id": order_id, "lines": lines_data})
            mrr = parsed["recurring_mrr"]
            arr = parsed["recurring_arr"]
            interval = parsed["billing_interval"] or "month"

            order_state = order_data.get("state", "draft")
            if order_state in ("sale", "done") and parsed["has_recurring"]:
                sub_state = "active"
                is_active = True
            elif order_state in ("draft", "sent"):
                sub_state = "draft"
                is_active = False
            else:
                sub_state = "inactive"
                is_active = False

            date_base = str(order_data.get("date_order") or datetime.now().strftime("%Y-%m-%d"))
            renewal_date = _add_billing_period(date_base, interval)

            return {
                "order_id": order_id,
                "active": is_active,
                "renewal_date": renewal_date,
                "recurring_interval": interval,
                "mrr": mrr,
                "state": sub_state,
                "arr": arr,
            }

        # 3. Standalone / Test In-Memory execution
        if order_id not in self._mock_orders:
            raise NotFoundError(f"Sale order {order_id} not found.")

        order_data = self._mock_orders[order_id]
        parsed = self.parse_mixed_order(order_data)
        mrr = parsed["recurring_mrr"]
        arr = parsed["recurring_arr"]
        interval = parsed["billing_interval"] or "month"

        order_state = order_data.get("state", "draft")
        meta = self._mock_subscription_metadata.get(order_id, {})

        if meta.get("active") is not None:
            is_active = meta["active"]
            sub_state = "active" if is_active else "inactive"
        elif order_state in ("sale", "done") and parsed["has_recurring"]:
            sub_state = "active"
            is_active = True
        elif order_state in ("draft", "sent"):
            sub_state = "draft"
            is_active = False
        else:
            sub_state = "inactive"
            is_active = False

        if meta.get("renewal_date"):
            renewal_date = meta["renewal_date"]
        else:
            date_base = str(order_data.get("date_order", datetime.now().strftime("%Y-%m-%d")))
            renewal_date = _add_billing_period(date_base, interval)

        return {
            "order_id": order_id,
            "active": is_active,
            "renewal_date": renewal_date,
            "recurring_interval": interval,
            "mrr": mrr,
            "state": sub_state,
            "arr": arr,
        }

    def trigger_subscription_renewal(self, order_id: int) -> Dict[str, Any]:
        """Generate a renewal invoice and advance the subscription renewal date.

        Ensures recurring invoices have dealflow_is_recurring=True and link to
        the DealFlow Deal ID.

        Args:
            order_id: The ID of the recurring sale order to renew.

        Returns:
            Dict containing:
                success: True
                order_id: ID of the order renewed
                renewal_invoice_id: ID of the created renewal invoice
                renewal_invoice_name: Name/number of the invoice
                amount_invoiced: Monetary sum invoiced for the period
                previous_renewal_date: Billing date prior to renewal
                next_renewal_date: Updated next billing date
                recurring_interval: Interval ('month' or 'year')
                state: 'renewed'

        Raises:
            NotFoundError: If the sale order does not exist.
            ValidationError: If the order has no recurring subscription lines.
            InvalidStateError: If the subscription is inactive or cancelled.
            OdooExecutionError: If invoice creation fails in Odoo.
        """
        order_id = int(order_id)
        status = self.get_subscription_status(order_id)

        if status["mrr"] <= 0.0:
            raise ValidationError(
                f"Order {order_id} has no recurring subscription items to renew."
            )

        if not status["active"]:
            raise InvalidStateError(
                f"Cannot renew subscription for order {order_id} in '{status['state']}' state. "
                "Order must be active ('sale' / 'done')."
            )

        prev_renewal_date = status["renewal_date"]
        interval = status["recurring_interval"]
        next_renewal_date = _add_billing_period(prev_renewal_date, interval)
        amount_to_invoice = status["mrr"] if interval == "month" else status["arr"]

        # 1. Native Odoo ORM execution
        if self.env is not None:
            try:
                order = self.env["sale.order"].browse(order_id)
                deal_id = getattr(order, "dealflow_deal_id", None)

                # Create recurring renewal invoice
                invoice_vals = {
                    "move_type": "out_invoice",
                    "partner_id": order.partner_id.id,
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "invoice_origin": f"{order.name} Renewal ({next_renewal_date})",
                    "dealflow_deal_id": deal_id,
                    "dealflow_is_recurring": True,
                }
                new_move = self.env["account.move"].create(invoice_vals)

                # Update next invoice date on order if model supports it
                if hasattr(order, "next_invoice_date"):
                    order.write({"next_invoice_date": next_renewal_date})

                return {
                    "success": True,
                    "order_id": order_id,
                    "renewal_invoice_id": new_move.id,
                    "renewal_invoice_name": new_move.name or f"INV/{new_move.id}",
                    "amount_invoiced": round(amount_to_invoice, 2),
                    "previous_renewal_date": prev_renewal_date,
                    "next_renewal_date": next_renewal_date,
                    "recurring_interval": interval,
                    "state": "renewed",
                    "message": f"Successfully generated subscription renewal invoice {new_move.name or new_move.id}.",
                }
            except Exception as exc:
                raise OdooExecutionError(
                    f"Failed to generate renewal invoice for order {order_id}: {str(exc)}"
                ) from exc

        # 2. Odoo RPC Client execution
        if self.odoo_client is not None:
            try:
                orders = self.odoo_client.execute_kw(
                    "sale.order",
                    "read",
                    [[order_id]],
                    {"fields": ["id", "name", "partner_id", "dealflow_deal_id"]},
                )
                order_rec = orders[0]
                deal_id = order_rec.get("dealflow_deal_id")
                partner_id = order_rec.get("partner_id", [False])[0]

                invoice_vals = {
                    "move_type": "out_invoice",
                    "partner_id": partner_id,
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "invoice_origin": f"{order_rec.get('name')} Renewal",
                    "dealflow_deal_id": deal_id,
                    "dealflow_is_recurring": True,
                }
                new_move_id = self.odoo_client.execute_kw(
                    "account.move",
                    "create",
                    [invoice_vals],
                )

                return {
                    "success": True,
                    "order_id": order_id,
                    "renewal_invoice_id": new_move_id,
                    "renewal_invoice_name": f"INV/{new_move_id}",
                    "amount_invoiced": round(amount_to_invoice, 2),
                    "previous_renewal_date": prev_renewal_date,
                    "next_renewal_date": next_renewal_date,
                    "recurring_interval": interval,
                    "state": "renewed",
                    "message": f"Successfully generated subscription renewal invoice INV/{new_move_id}.",
                }
            except Exception as exc:
                raise OdooExecutionError(
                    f"RPC renewal failed for order {order_id}: {str(exc)}"
                ) from exc

        # 3. Standalone / Test In-Memory execution
        order_dict = self._mock_orders[order_id]
        deal_id = order_dict.get("dealflow_deal_id")

        new_inv_id = self.accounting_adapter._next_invoice_id
        self.accounting_adapter._next_invoice_id += 1
        inv_name = f"INV/{datetime.now().year}/SUB-{new_inv_id:04d}"

        renewal_invoice = {
            "id": new_inv_id,
            "invoice_id": new_inv_id,
            "name": inv_name,
            "order_id": order_id,
            "invoice_origin": f"{order_dict.get('name', f'SO-{order_id}')} Renewal",
            "move_type": "out_invoice",
            "state": "posted",
            "payment_state": "not_paid",
            "amount_total": amount_to_invoice,
            "amount_residual": amount_to_invoice,
            "dealflow_deal_id": deal_id,
            "dealflow_is_recurring": True,
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
        }
        self.accounting_adapter.register_mock_invoice(renewal_invoice)

        # Update next renewal date in subscription metadata
        self._mock_subscription_metadata[order_id] = {
            "renewal_date": next_renewal_date,
            "active": True,
        }

        return {
            "success": True,
            "order_id": order_id,
            "renewal_invoice_id": new_inv_id,
            "renewal_invoice_name": inv_name,
            "amount_invoiced": round(amount_to_invoice, 2),
            "previous_renewal_date": prev_renewal_date,
            "next_renewal_date": next_renewal_date,
            "recurring_interval": interval,
            "state": "renewed",
            "message": f"Successfully generated subscription renewal invoice {inv_name}.",
        }
