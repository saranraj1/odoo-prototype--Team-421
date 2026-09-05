"""DealFlow360 Odoo Integration — Accounting Adapter.

Provides native Odoo accounting integration:
- Atomic invoice generation for confirmed sales orders
- Association of DealFlow Deal IDs to accounting moves
- Real-time invoice balance and payment state tracking
- Aggregate order-level financial and payment status calculation
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

try:
    from dealflow_odoo.schemas import (
        DealFlowIntegrationError,
        ValidationError,
        NotFoundError,
        InvalidStateError,
        OdooExecutionError,
    )
    from dealflow_odoo.constants import (
        EVENT_INVOICE_CREATED,
        EVENT_PAYMENT_RECORDED,
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
    )
    from ..constants import (  # type: ignore[no-redef]
        EVENT_INVOICE_CREATED,
        EVENT_PAYMENT_RECORDED,
        ERR_VALIDATION,
        ERR_NOT_FOUND,
        ERR_INVALID_STATE,
        ERR_ODOO_FAILURE,
    )


class AccountingAdapter:
    """Service adapter managing native Odoo accounting and financial operations.

    Handles creation, inspection, and payment aggregation of invoices without
    creating a redundant or divergent accounting source of truth outside Odoo.
    """

    def __init__(
        self,
        odoo_client: Optional[Any] = None,
        env: Optional[Any] = None,
    ) -> None:
        """Initialize the accounting adapter.

        Args:
            odoo_client: Optional RPC client connection to Odoo.
            env: Optional native Odoo ORM environment (when executed inside Odoo).
        """
        self.odoo_client = odoo_client
        self.env = env
        # In-memory storage for standalone unit tests / simulation runs
        self._mock_orders: Dict[int, Dict[str, Any]] = {}
        self._mock_invoices: Dict[int, Dict[str, Any]] = {}
        self._next_invoice_id: int = 1001

    # -------------------------------------------------------------------------
    # In-Memory Test Fixture Helpers
    # -------------------------------------------------------------------------

    def register_mock_order(self, order_dict: Dict[str, Any]) -> None:
        """Register or update an order in the in-memory test store."""
        order_id = int(order_dict.get("id", order_dict.get("order_id", 0)))
        if not order_id:
            raise ValidationError("Order must contain an 'id' or 'order_id'.")
        self._mock_orders[order_id] = dict(order_dict)

    def register_mock_invoice(self, invoice_dict: Dict[str, Any]) -> None:
        """Register or update an invoice in the in-memory test store."""
        invoice_id = int(invoice_dict.get("id", invoice_dict.get("invoice_id", 0)))
        if not invoice_id:
            raise ValidationError("Invoice must contain an 'id' or 'invoice_id'.")
        self._mock_invoices[invoice_id] = dict(invoice_dict)

    # -------------------------------------------------------------------------
    # Core Accounting Operations
    # -------------------------------------------------------------------------

    def create_invoice(
        self,
        order_id: int,
        invoice_type: str = "out_invoice",
    ) -> Dict[str, Any]:
        """Atomically create an invoice for a confirmed sale order.

        Associates dealflow_deal_id from the order to the created invoice.

        Args:
            order_id: The ID of the confirmed Odoo sale order.
            invoice_type: Invoice move_type ('out_invoice' for customer invoice).

        Returns:
            Dict containing: invoice_id, name, amount_total, state.

        Raises:
            NotFoundError: If the sale order cannot be found.
            InvalidStateError: If the order is not in a confirmed state ('sale' or 'done').
            OdooExecutionError: If invoice creation fails in Odoo.
        """
        order_id = int(order_id)

        # 1. Native Odoo ORM execution (when running inside Odoo runtime)
        if self.env is not None:
            try:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

                # Odoo sale order must be in confirmed state
                if order.state not in ("sale", "done"):
                    raise InvalidStateError(
                        f"Cannot invoice order {order_id} in state '{order.state}'. "
                        "Order must be confirmed ('sale' or 'done') prior to invoicing."
                    )

                # Atomic native invoice creation
                invoices = order._create_invoices(final=True)
                if not invoices:
                    raise OdooExecutionError(
                        f"Odoo failed to generate invoices for order {order_id}."
                    )

                deal_id = getattr(order, "dealflow_deal_id", None)
                for inv in invoices:
                    write_vals: Dict[str, Any] = {}
                    if deal_id:
                        write_vals["dealflow_deal_id"] = deal_id
                    if invoice_type:
                        write_vals["move_type"] = invoice_type
                    if write_vals:
                        inv.write(write_vals)

                primary_invoice = invoices[0]
                return {
                    "invoice_id": primary_invoice.id,
                    "name": primary_invoice.name or f"INV/{primary_invoice.id}",
                    "amount_total": float(primary_invoice.amount_total),
                    "state": primary_invoice.state,
                    "payment_state": getattr(primary_invoice, "payment_state", "not_paid") or "not_paid",
                    "dealflow_deal_id": deal_id,
                }
            except (NotFoundError, InvalidStateError, OdooExecutionError):
                raise
            except Exception as exc:
                raise OdooExecutionError(
                    f"Unexpected error during invoice creation for order {order_id}: {str(exc)}"
                ) from exc

        # 2. Odoo RPC Client execution (when communicating via XML-RPC / JSON-RPC)
        if self.odoo_client is not None:
            try:
                orders = self.odoo_client.execute_kw(
                    "sale.order",
                    "read",
                    [[order_id]],
                    {"fields": ["id", "name", "state", "dealflow_deal_id", "amount_total"]},
                )
                if not orders:
                    raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

                order_record = orders[0]
                state = order_record.get("state")
                if state not in ("sale", "done"):
                    raise InvalidStateError(
                        f"Cannot invoice order {order_id} in state '{state}'. "
                        "Order must be confirmed ('sale' or 'done') prior to invoicing."
                    )

                deal_id = order_record.get("dealflow_deal_id")

                # Invoke native Odoo invoice creation
                created_invoice_ids = self.odoo_client.execute_kw(
                    "sale.order",
                    "_create_invoices",
                    [[order_id]],
                    {"final": True},
                )
                if not created_invoice_ids:
                    raise OdooExecutionError(f"Odoo returned no invoices for order {order_id}.")

                first_invoice_id = created_invoice_ids[0]
                if deal_id:
                    self.odoo_client.execute_kw(
                        "account.move",
                        "write",
                        [[first_invoice_id], {"dealflow_deal_id": deal_id}],
                    )

                read_res = self.odoo_client.execute_kw(
                    "account.move",
                    "read",
                    [[first_invoice_id]],
                    {"fields": ["id", "name", "amount_total", "state", "payment_state"]},
                )
                inv_data = read_res[0] if read_res else {}
                return {
                    "invoice_id": first_invoice_id,
                    "name": inv_data.get("name") or f"INV/{first_invoice_id}",
                    "amount_total": float(inv_data.get("amount_total", 0.0)),
                    "state": inv_data.get("state", "draft"),
                    "payment_state": inv_data.get("payment_state", "not_paid"),
                    "dealflow_deal_id": deal_id,
                }
            except (NotFoundError, InvalidStateError, OdooExecutionError):
                raise
            except Exception as exc:
                raise OdooExecutionError(
                    f"RPC invoice creation failed for order {order_id}: {str(exc)}"
                ) from exc

        # 3. Standalone / Test In-Memory execution
        if order_id not in self._mock_orders:
            raise NotFoundError(f"Sale order {order_id} not found.")

        mock_order = self._mock_orders[order_id]
        order_state = mock_order.get("state", "draft")
        if order_state not in ("sale", "done"):
            raise InvalidStateError(
                f"Cannot invoice order {order_id} in state '{order_state}'. "
                "Order must be confirmed ('sale' or 'done') prior to invoicing."
            )

        new_id = self._next_invoice_id
        self._next_invoice_id += 1

        deal_id = mock_order.get("dealflow_deal_id")
        amount_total = float(mock_order.get("amount_total", 0.0))
        order_name = mock_order.get("name", f"SO-{order_id}")
        inv_name = f"INV/{datetime.now().year}/{new_id:04d}"

        invoice_record = {
            "id": new_id,
            "invoice_id": new_id,
            "name": inv_name,
            "order_id": order_id,
            "invoice_origin": order_name,
            "move_type": invoice_type,
            "state": "posted",
            "payment_state": "not_paid",
            "amount_total": amount_total,
            "amount_residual": amount_total,
            "dealflow_deal_id": deal_id,
            "dealflow_is_recurring": False,
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
        }
        self._mock_invoices[new_id] = invoice_record

        # Link invoice back to order record
        if "invoice_ids" not in mock_order:
            mock_order["invoice_ids"] = []
        mock_order["invoice_ids"].append(new_id)

        return {
            "invoice_id": new_id,
            "name": inv_name,
            "amount_total": amount_total,
            "state": "posted",
            "payment_state": "not_paid",
            "dealflow_deal_id": deal_id,
        }

    def get_invoice(self, invoice_id: int) -> Dict[str, Any]:
        """Read invoice state, amount_total, amount_residual, and payment_state.

        Args:
            invoice_id: The ID of the invoice move to query.

        Returns:
            Dict containing: invoice_id, name, state, amount_total,
            amount_residual, payment_state ('not_paid', 'in_payment', 'paid'),
            dealflow_deal_id, dealflow_is_recurring.

        Raises:
            NotFoundError: If the invoice cannot be located.
            OdooExecutionError: If an unexpected error occurs during retrieval.
        """
        invoice_id = int(invoice_id)

        # 1. Native Odoo ORM execution
        if self.env is not None:
            try:
                move = self.env["account.move"].browse(invoice_id)
                if not move.exists():
                    raise NotFoundError(f"Invoice {invoice_id} not found in Odoo.")

                payment_state = move.payment_state or "not_paid"
                amount_residual = float(move.amount_residual)
                amount_total = float(move.amount_total)

                return {
                    "invoice_id": move.id,
                    "name": move.name or f"INV/{move.id}",
                    "state": move.state,
                    "amount_total": round(amount_total, 2),
                    "amount_residual": round(amount_residual, 2),
                    "payment_state": payment_state,
                    "is_paid": (payment_state == "paid" or (amount_total > 0 and amount_residual <= 0.0)),
                    "dealflow_deal_id": getattr(move, "dealflow_deal_id", None),
                    "dealflow_is_recurring": bool(getattr(move, "dealflow_is_recurring", False)),
                }
            except NotFoundError:
                raise
            except Exception as exc:
                raise OdooExecutionError(
                    f"Error reading invoice {invoice_id} from Odoo: {str(exc)}"
                ) from exc

        # 2. Odoo RPC Client execution
        if self.odoo_client is not None:
            try:
                moves = self.odoo_client.execute_kw(
                    "account.move",
                    "read",
                    [[invoice_id]],
                    {
                        "fields": [
                            "id",
                            "name",
                            "state",
                            "amount_total",
                            "amount_residual",
                            "payment_state",
                            "dealflow_deal_id",
                            "dealflow_is_recurring",
                        ]
                    },
                )
                if not moves:
                    raise NotFoundError(f"Invoice {invoice_id} not found in Odoo.")

                m = moves[0]
                payment_state = m.get("payment_state") or "not_paid"
                amount_residual = float(m.get("amount_residual", 0.0))
                amount_total = float(m.get("amount_total", 0.0))

                return {
                    "invoice_id": m.get("id"),
                    "name": m.get("name") or f"INV/{invoice_id}",
                    "state": m.get("state", "draft"),
                    "amount_total": round(amount_total, 2),
                    "amount_residual": round(amount_residual, 2),
                    "payment_state": payment_state,
                    "is_paid": (payment_state == "paid" or (amount_total > 0 and amount_residual <= 0.0)),
                    "dealflow_deal_id": m.get("dealflow_deal_id"),
                    "dealflow_is_recurring": bool(m.get("dealflow_is_recurring", False)),
                }
            except NotFoundError:
                raise
            except Exception as exc:
                raise OdooExecutionError(
                    f"RPC read failed for invoice {invoice_id}: {str(exc)}"
                ) from exc

        # 3. Standalone / Test In-Memory execution
        if invoice_id not in self._mock_invoices:
            raise NotFoundError(f"Invoice {invoice_id} not found.")

        inv = self._mock_invoices[invoice_id]
        amount_total = float(inv.get("amount_total", 0.0))
        amount_residual = float(inv.get("amount_residual", 0.0))
        payment_state = inv.get("payment_state", "not_paid")

        return {
            "invoice_id": invoice_id,
            "name": inv.get("name", f"INV/{invoice_id}"),
            "state": inv.get("state", "posted"),
            "amount_total": round(amount_total, 2),
            "amount_residual": round(amount_residual, 2),
            "payment_state": payment_state,
            "is_paid": (payment_state == "paid" or (amount_total > 0 and amount_residual <= 0.0)),
            "dealflow_deal_id": inv.get("dealflow_deal_id"),
            "dealflow_is_recurring": bool(inv.get("dealflow_is_recurring", False)),
        }

    def get_order_invoices(self, order_id: int) -> List[Dict[str, Any]]:
        """List all invoices linked to a sale order.

        Args:
            order_id: The ID of the sale order.

        Returns:
            List[Dict] of invoice summaries linked to the order.

        Raises:
            NotFoundError: If the sale order cannot be found.
        """
        order_id = int(order_id)

        # 1. Native Odoo ORM execution
        if self.env is not None:
            order = self.env["sale.order"].browse(order_id)
            if not order.exists():
                raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

            invoices = order.invoice_ids
            return [self.get_invoice(inv.id) for inv in invoices]

        # 2. Odoo RPC Client execution
        if self.odoo_client is not None:
            orders = self.odoo_client.execute_kw(
                "sale.order",
                "read",
                [[order_id]],
                {"fields": ["id", "invoice_ids"]},
            )
            if not orders:
                raise NotFoundError(f"Sale order {order_id} not found in Odoo.")

            invoice_ids = orders[0].get("invoice_ids", [])
            return [self.get_invoice(inv_id) for inv_id in invoice_ids]

        # 3. Standalone / Test In-Memory execution
        if order_id not in self._mock_orders:
            raise NotFoundError(f"Sale order {order_id} not found.")

        matched: List[Dict[str, Any]] = []
        for inv_id, inv in self._mock_invoices.items():
            if inv.get("order_id") == order_id:
                matched.append(self.get_invoice(inv_id))

        return matched

    def get_payment_status(self, order_id: int) -> Dict[str, Any]:
        """Return overall payment summary for a sale order.

        Calculates the aggregate financial standing across all linked invoices:
        is_paid, amount_paid, amount_due, payment_state.

        Args:
            order_id: The ID of the sale order.

        Returns:
            Dict containing:
                is_paid: Boolean indicating if all invoices are completely satisfied.
                amount_paid: Total amount paid to date.
                amount_due: Remaining outstanding balance.
                payment_state: Aggregate state ('not_paid', 'in_payment', 'paid').
                invoices_count: Total number of linked invoices.
        """
        order_id = int(order_id)
        invoices = self.get_order_invoices(order_id)

        if not invoices:
            # Check if order exists to raise NotFoundError appropriately
            if self.env is not None:
                order = self.env["sale.order"].browse(order_id)
                if not order.exists():
                    raise NotFoundError(f"Sale order {order_id} not found in Odoo.")
                total_expected = float(order.amount_total)
            elif self.odoo_client is not None:
                orders = self.odoo_client.execute_kw(
                    "sale.order",
                    "read",
                    [[order_id]],
                    {"fields": ["id", "amount_total"]},
                )
                if not orders:
                    raise NotFoundError(f"Sale order {order_id} not found in Odoo.")
                total_expected = float(orders[0].get("amount_total", 0.0))
            else:
                if order_id not in self._mock_orders:
                    raise NotFoundError(f"Sale order {order_id} not found.")
                total_expected = float(self._mock_orders[order_id].get("amount_total", 0.0))

            return {
                "order_id": order_id,
                "is_paid": False,
                "amount_paid": 0.0,
                "amount_due": round(total_expected, 2),
                "payment_state": "not_paid",
                "invoices_count": 0,
            }

        # Calculate metrics across non-cancelled invoices
        valid_invoices = [inv for inv in invoices if inv.get("state") != "cancel"]
        if not valid_invoices:
            return {
                "order_id": order_id,
                "is_paid": False,
                "amount_paid": 0.0,
                "amount_due": 0.0,
                "payment_state": "not_paid",
                "invoices_count": len(invoices),
            }

        total_invoiced = sum(inv["amount_total"] for inv in valid_invoices)
        total_due = sum(inv["amount_residual"] for inv in valid_invoices)
        total_paid = max(0.0, total_invoiced - total_due)

        is_paid = (total_invoiced > 0.0 and total_due <= 0.0)

        # Determine consolidated payment_state
        if is_paid:
            aggregate_state = "paid"
        elif any(inv["payment_state"] == "in_payment" for inv in valid_invoices):
            aggregate_state = "in_payment"
        elif total_paid > 0.0:
            aggregate_state = "in_payment"
        else:
            aggregate_state = "not_paid"

        return {
            "order_id": order_id,
            "is_paid": is_paid,
            "amount_paid": round(total_paid, 2),
            "amount_due": round(total_due, 2),
            "payment_state": aggregate_state,
            "invoices_count": len(valid_invoices),
        }

    # -------------------------------------------------------------------------
    # Payment Recording Helper (Odoo/Mock Simulation)
    # -------------------------------------------------------------------------

    def record_payment(
        self,
        invoice_id: int,
        amount: Optional[float] = None,
        payment_method: str = "bank",
    ) -> Dict[str, Any]:
        """Record a payment against an invoice and update balance.

        Args:
            invoice_id: Invoice ID to pay.
            amount: Optional specific amount. If None, pays full residual.
            payment_method: 'bank', 'cash', or 'card'.

        Returns:
            Dict with updated invoice financial summary.
        """
        invoice = self.get_invoice(invoice_id)
        residual = invoice["amount_residual"]

        pay_amount = residual if (amount is None or amount > residual) else float(amount)
        new_residual = max(0.0, residual - pay_amount)
        new_state = "paid" if new_residual <= 0.0 else "in_payment"

        # Update in-memory mock if present
        if invoice_id in self._mock_invoices:
            self._mock_invoices[invoice_id]["amount_residual"] = new_residual
            self._mock_invoices[invoice_id]["payment_state"] = new_state

        return {
            "invoice_id": invoice_id,
            "amount_paid": round(pay_amount, 2),
            "amount_residual": round(new_residual, 2),
            "payment_state": new_state,
            "is_paid": (new_state == "paid"),
        }
