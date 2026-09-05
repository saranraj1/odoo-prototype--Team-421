# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Sale Order Line Model Extension.

Extends 'sale.order.line' with DealFlow approved discount tracking,
recurring line indicators, cost computation, and margin calculations.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

try:
    from odoo import _, api, fields, models
    from odoo.exceptions import UserError, ValidationError as OdooValidationError
except ImportError:
    from datetime import datetime as _dt

    class _MockDatetimeField:
        def __call__(self, *args, **kwargs):
            return None

        @classmethod
        def now(cls):
            return _dt.now().strftime("%Y-%m-%d %H:%M:%S")

        @classmethod
        def today(cls):
            return _dt.now().strftime("%Y-%m-%d")

    class _MockFields:
        def Char(self, *args, **kwargs): return None
        def Float(self, *args, **kwargs): return None
        def Boolean(self, *args, **kwargs): return None
        def Selection(self, *args, **kwargs): return None
        def Date(self, *args, **kwargs): return None
        def Many2one(self, *args, **kwargs): return None
        def One2many(self, *args, **kwargs): return None
        Datetime = _MockDatetimeField()

    class _MockAPI:
        @staticmethod
        def depends(*args):
            def decorator(f): return f
            return decorator
        @staticmethod
        def onchange(*args):
            def decorator(f): return f
            return decorator
        @staticmethod
        def constrains(*args):
            def decorator(f): return f
            return decorator

    class _MockModels:
        class Model:
            _name = None
            _inherit = None
            _description = None

            def write(self, vals):
                return True

    class UserError(Exception): pass
    class OdooValidationError(Exception): pass
    def _(text): return text

    fields = _MockFields()
    api = _MockAPI()
    models = _MockModels()

try:
    from ..constants import (
        APPROVAL_STATE_APPROVED,
        APPROVAL_STATE_REAPPROVAL_REQUIRED,
    )
except (ImportError, ValueError):
    from dealflow_odoo.constants import (
        APPROVAL_STATE_APPROVED,
        APPROVAL_STATE_REAPPROVAL_REQUIRED,
    )

_logger = logging.getLogger(__name__)


class SaleOrderLine(models.Model):
    """Extension of standard Odoo sale.order.line for DealFlow governance."""

    _inherit = "sale.order.line"

    # DealFlow Specific Fields
    dealflow_approved_discount = fields.Float(
        string="Approved Discount %",
        default=0.0,
        digits=(5, 2),
        help="Discount percentage officially approved by DealFlow governance.",
    )
    dealflow_is_recurring = fields.Boolean(
        string="Is Recurring Line",
        default=False,
        help="Indicates whether this line represents recurring subscription revenue (MRR/ARR).",
    )
    dealflow_recurring_interval = fields.Selection(
        selection=[
            ("month", "Monthly"),
            ("year", "Annually"),
        ],
        string="Recurring Interval",
        default=None,
        help="Billing frequency for recurring line item.",
    )
    dealflow_cost_price = fields.Float(
        string="Cost Price",
        compute="_compute_cost_price",
        store=True,
        digits="Product Price",
        help="Unit cost price of the product used for deal margin computation.",
    )
    dealflow_margin = fields.Float(
        string="Margin",
        compute="_compute_dealflow_margin",
        store=True,
        digits="Product Price",
        help="Line contribution margin: price_subtotal minus total line cost.",
    )

    @api.depends("product_id", "product_id.standard_price")
    def _compute_cost_price(self) -> None:
        """Compute cost price from product standard price or purchase price."""
        for line in self:
            if line.product_id:
                # Prefer purchase_price if sale_margin is installed, otherwise standard_price
                purchase_cost = getattr(line, "purchase_price", None)
                if purchase_cost:
                    line.dealflow_cost_price = float(purchase_cost)
                else:
                    line.dealflow_cost_price = float(line.product_id.standard_price or 0.0)
            else:
                line.dealflow_cost_price = 0.0

    @api.depends("price_subtotal", "dealflow_cost_price", "product_uom_qty")
    def _compute_dealflow_margin(self) -> None:
        """Compute line margin as subtotal minus total unit cost."""
        for line in self:
            if line.display_type:
                line.dealflow_margin = 0.0
                continue
            total_cost = (line.dealflow_cost_price or 0.0) * (line.product_uom_qty or 0.0)
            line.dealflow_margin = round((line.price_subtotal or 0.0) - total_cost, 2)

    @api.onchange("product_id")
    def _onchange_product_id_dealflow(self) -> None:
        """Auto-populate cost price and detect recurring subscriptions on product selection."""
        if not self.product_id:
            return
        self.dealflow_cost_price = self.product_id.standard_price or 0.0

        # Auto-detect subscription/recurring products based on name or category naming
        prod_name = (self.product_id.name or "").lower()
        categ_name = (self.product_id.categ_id.name or "").lower() if self.product_id.categ_id else ""
        combined_desc = f"{prod_name} {categ_name}"

        if any(term in combined_desc for term in ("recurring", "subscription", "monthly", "annual", "saas")):
            self.dealflow_is_recurring = True
            if not self.dealflow_recurring_interval:
                self.dealflow_recurring_interval = "year" if "annual" in combined_desc or "year" in combined_desc else "month"

    @api.constrains("discount", "product_uom_qty")
    def _check_dealflow_line_constraints(self) -> None:
        """Enforce strict business rules on discount boundaries and quantities."""
        for line in self:
            if line.discount < 0.0 or line.discount > 100.0:
                raise OdooValidationError(
                    _(f"Discount must be between 0.0% and 100.0%. Received: {line.discount}%.")
                )
            if not getattr(line, "display_type", False) and (line.product_uom_qty or 0.0) <= 0.0:
                raise OdooValidationError(
                    _(f"Order line quantity must be strictly positive. Received: {line.product_uom_qty}.")
                )

    def write(self, vals: Dict[str, Any]) -> bool:
        """Governance guard on order line modification.

        If discount, price, or quantity is altered directly on an order line after
        the parent order was approved, auto-transition the order to
        'reapproval_required' and engage the dealflow lock.
        """
        # Validate discount boundary
        if "discount" in vals:
            disc_val = float(vals["discount"])
            if disc_val < 0.0 or disc_val > 100.0:
                raise OdooValidationError(
                    _(f"Discount must be between 0.0% and 100.0%. Received: {disc_val}%.")
                )

        # Validate strictly positive quantity
        if "product_uom_qty" in vals:
            qty_val = float(vals["product_uom_qty"])
            if qty_val <= 0.0:
                for line in self:
                    if not getattr(line, "display_type", False):
                        raise OdooValidationError(
                            _(f"Order line quantity must be strictly positive. Received: {qty_val}.")
                        )

        # Skip if explicitly bypassed in context
        ctx = getattr(self.env, "context", {}) or getattr(self, "_context", {}) or {}
        if ctx.get("dealflow_skip_reapproval"):
            return super().write(vals)

        orders_to_reapprove = []
        sensitive_fields = {"discount", "price_unit", "product_uom_qty"}

        if sensitive_fields & set(vals.keys()):
            for line in self:
                order = line.order_id
                if not order:
                    continue
                if order.dealflow_approval_state == APPROVAL_STATE_APPROVED:
                    # Check if discount differs from approved discount
                    if "discount" in vals and vals["discount"] != line.dealflow_approved_discount:
                        orders_to_reapprove.append(order)
                    elif "price_unit" in vals or "product_uom_qty" in vals:
                        orders_to_reapprove.append(order)

        res = super().write(vals)

        if orders_to_reapprove:
            for order in orders_to_reapprove:
                order.with_context(dealflow_skip_reapproval=True).write({
                    "dealflow_approval_state": APPROVAL_STATE_REAPPROVAL_REQUIRED,
                    "dealflow_locked": True,
                })
                if hasattr(order, "message_post"):
                    order.message_post(
                        body=_(
                            "DealFlow Governance: Order line pricing was modified directly after approval. "
                            "Approval state set to 'Reapproval Required' and order locked."
                        ),
                        message_type="notification",
                        subtype_xmlid="mail.mt_note",
                    )

        return res
