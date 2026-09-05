# -*- coding: utf-8 -*-
"""DealFlow360 — Stock Picking Model Extension.

Inherits 'stock.picking' to track multi-warehouse fulfillment batches,
split shipment flags, and allocation breakdown details.
"""

from typing import Any, Dict, Optional
import json

try:
    from odoo import models, fields, api
except ImportError:
    # Standalone / test fallback when running outside active Odoo server
    class _Field:
        def __init__(self, string: Optional[str] = None, **kwargs: Any):
            self.string = string
            self.kwargs = kwargs

    class _Fields:
        Char = _Field
        Boolean = _Field
        Text = _Field

    class _Model:
        _name: Optional[str] = None
        _inherit: Optional[str] = None
        _description: Optional[str] = None

    class _Models:
        Model = _Model

    models = _Models()  # type: ignore
    fields = _Fields()  # type: ignore
    api = None  # type: ignore


class StockPicking(models.Model):
    """DealFlow Multi-Warehouse Fulfillment Picking Extension.

    Adds fulfillment batch tracking, multi-warehouse split flags,
    and detailed allocation metadata to Odoo's native stock.picking model.
    """

    _inherit = "stock.picking"
    _description = "DealFlow Multi-Warehouse Fulfillment Picking"

    dealflow_fulfillment_batch_id = fields.Char(
        string="DealFlow Fulfillment Batch",
        index=True,
        help="Unique identifier grouping all pickings generated from a single DealFlow multi-warehouse split.",
    )
    dealflow_warehouse_split = fields.Boolean(
        string="Split Warehouse Shipment",
        default=False,
        help="Indicates whether this picking is part of a multi-warehouse split fulfillment plan.",
    )
    dealflow_split_details = fields.Text(
        string="Split Allocation Details",
        help="JSON-encoded split allocation breakdown for auditability and operational transparency.",
    )

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
            "context": dict(self.env.context if hasattr(self, "env") and self.env else {}),
        }
