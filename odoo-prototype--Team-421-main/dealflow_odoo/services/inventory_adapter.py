# -*- coding: utf-8 -*-
"""DealFlow360 — Inventory & Fulfillment Adapter Service.

Provides real Odoo inventory querying, multi-warehouse availability analysis,
intelligent greedy split calculations, and atomic execution of fulfillment plans
with DealFlow batch tracking.
"""

from typing import Any, Dict, List, Optional, Union
import json
import uuid
import time
from datetime import datetime

try:
    from dealflow_odoo.schemas import (
        FulfillmentPlanDTO,
        FulfillmentSplitItem,
        ValidationError,
        InvalidStateError,
        NotFoundError,
        OdooExecutionError,
    )
except ImportError:
    from ..schemas import (  # type: ignore
        FulfillmentPlanDTO,
        FulfillmentSplitItem,
        ValidationError,
        InvalidStateError,
        NotFoundError,
        OdooExecutionError,
    )


class InventoryAdapter:
    """Adapter facilitating inventory inspection and multi-warehouse fulfillment splitting.

    Works seamlessly in both active Odoo ORM environments (via self.env) and
    standalone/test environments with an integrated in-memory inventory store.
    """

    def __init__(
        self,
        env: Any = None,
        warehouse_data: Optional[List[Dict[str, Any]]] = None,
        stock_data: Optional[Dict[int, Dict[int, Dict[str, float]]]] = None,
    ):
        """Initialize the InventoryAdapter.

        :param env: Odoo Environment instance (optional). If provided, ORM queries are used.
        :param warehouse_data: Optional warehouse list for standalone/test execution.
        :param stock_data: Optional initial stock mapping: {product_id: {warehouse_id: {qty_available, qty_reserved, qty_incoming}}}.
        """
        self.env = env

        # Default warehouses in deterministic routing order (WH1 Main -> WH2 East -> WH3 West)
        self._warehouses: List[Dict[str, Any]] = warehouse_data or [
            {"warehouse_id": 1, "warehouse_name": "WH1 Main", "code": "WH1", "sequence": 1},
            {"warehouse_id": 2, "warehouse_name": "WH2 East", "code": "WH2", "sequence": 2},
            {"warehouse_id": 3, "warehouse_name": "WH3 West", "code": "WH3", "sequence": 3},
        ]

        # In-memory stock store: {product_id: {warehouse_id: {qty_available, qty_reserved, qty_incoming}}}
        self._stock_store: Dict[int, Dict[int, Dict[str, float]]] = {}
        if stock_data:
            self._stock_store = stock_data
        else:
            # Seed default demo scenario: WH1 has 9.0, WH2 has 15.0, WH3 has 10.0
            # For requested_qty=15, allocates 9 from WH1 and 6 from WH2!
            self.seed_inventory(
                product_id=1,
                warehouse_stocks={
                    1: {"qty_available": 9.0, "qty_reserved": 0.0, "qty_incoming": 5.0},
                    2: {"qty_available": 15.0, "qty_reserved": 0.0, "qty_incoming": 10.0},
                    3: {"qty_available": 10.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                },
            )

        # In-memory pickings and orders store for standalone operation
        self._pickings: List[Dict[str, Any]] = []
        self._orders: Dict[int, Dict[str, Any]] = {
            1: {"order_id": 1, "name": "SO0001", "state": "sale"},
            101: {"order_id": 101, "name": "SO0101", "state": "sale"},
        }
        self._next_picking_id: int = 1001

    # -------------------------------------------------------------------------
    # Helper & Configuration Methods (Standalone & Testing Support)
    # -------------------------------------------------------------------------

    def seed_inventory(
        self,
        product_id: int,
        warehouse_stocks: Dict[int, Dict[str, float]],
    ) -> None:
        """Seed or update in-memory stock for a specific product across warehouses."""
        if product_id not in self._stock_store:
            self._stock_store[product_id] = {}
        for wh_id, levels in warehouse_stocks.items():
            self._stock_store[product_id][wh_id] = {
                "qty_available": float(levels.get("qty_available", 0.0)),
                "qty_reserved": float(levels.get("qty_reserved", 0.0)),
                "qty_incoming": float(levels.get("qty_incoming", 0.0)),
            }

    def set_warehouse_stock(
        self,
        product_id: int,
        warehouse_id: int,
        qty_available: float,
        qty_reserved: float = 0.0,
        qty_incoming: float = 0.0,
    ) -> None:
        """Convenience method to set stock for a specific product and warehouse."""
        if product_id not in self._stock_store:
            self._stock_store[product_id] = {}
        self._stock_store[product_id][warehouse_id] = {
            "qty_available": float(qty_available),
            "qty_reserved": float(qty_reserved),
            "qty_incoming": float(qty_incoming),
        }

    def register_order(self, order_id: int, name: Optional[str] = None, state: str = "sale") -> None:
        """Register an order in the standalone adapter store."""
        self._orders[order_id] = {
            "order_id": order_id,
            "name": name or f"SO{order_id:04d}",
            "state": state,
        }

    def add_standalone_picking(
        self,
        order_id: int,
        warehouse_id: int,
        warehouse_name: str,
        state: str = "assigned",
        dealflow_fulfillment_batch_id: Optional[str] = None,
        dealflow_warehouse_split: bool = False,
        dealflow_split_details: Optional[str] = None,
    ) -> int:
        """Add an open picking into the in-memory store for testing and auditing."""
        picking_id = self._next_picking_id
        self._next_picking_id += 1
        picking = {
            "picking_id": picking_id,
            "name": f"WH/{warehouse_name[:4].strip().upper()}/OUT/{order_id:04d}-{picking_id}",
            "order_id": order_id,
            "warehouse_id": warehouse_id,
            "warehouse_name": warehouse_name,
            "state": state,
            "dealflow_fulfillment_batch_id": dealflow_fulfillment_batch_id,
            "dealflow_warehouse_split": dealflow_warehouse_split,
            "dealflow_split_details": dealflow_split_details,
            "origin": f"SO{order_id:04d}",
        }
        self._pickings.append(picking)
        return picking_id

    def _get_warehouse_stock_single(self, product_id: int, warehouse_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve stock data for a specific warehouse and product."""
        warehouse_list = self.get_warehouse_stock(product_id)
        for wh in warehouse_list:
            if wh["warehouse_id"] == warehouse_id:
                return wh
        return None

    # -------------------------------------------------------------------------
    # Core Adapter API
    # -------------------------------------------------------------------------

    def get_available_stock(self, product_id: int) -> float:
        """Retrieve total quantity on hand across all warehouses.

        :param product_id: Odoo product.product ID.
        :return: Total quantity available/on hand across all warehouses.
        :raises ValidationError: If product_id is not a positive integer.
        :raises NotFoundError: If product is not found in Odoo.
        """
        if not isinstance(product_id, int) or product_id <= 0:
            raise ValidationError(
                f"Invalid product_id: {product_id}. Must be a positive integer.",
                details={"product_id": product_id},
            )

        if self.env is not None:
            Product = self.env["product.product"]
            product = Product.browse(product_id)
            if not product.exists():
                raise NotFoundError(
                    f"Product with ID {product_id} not found in Odoo.",
                    details={"product_id": product_id},
                )
            # In standard Odoo, product.qty_available is the total on-hand stock across internal locations
            return float(getattr(product, "qty_available", 0.0))

        # Standalone / In-memory execution
        wh_stocks = self.get_warehouse_stock(product_id)
        total_avail = sum(item["qty_available"] for item in wh_stocks)
        return float(total_avail)

    def get_warehouse_stock(self, product_id: int) -> List[Dict[str, Any]]:
        """Retrieve stock breakdown per warehouse.

        Returns a list of dicts with:
          - warehouse_id: int
          - warehouse_name: str
          - qty_available: float (free / unreserved available stock)
          - qty_reserved: float
          - qty_incoming: float

        :param product_id: Odoo product.product ID.
        :return: List of warehouse inventory summaries ordered by priority.
        :raises ValidationError: If product_id is not a positive integer.
        :raises NotFoundError: If product is not found in Odoo.
        """
        if not isinstance(product_id, int) or product_id <= 0:
            raise ValidationError(
                f"Invalid product_id: {product_id}. Must be a positive integer.",
                details={"product_id": product_id},
            )

        if self.env is not None:
            Product = self.env["product.product"]
            product = Product.browse(product_id)
            if not product.exists():
                raise NotFoundError(
                    f"Product with ID {product_id} not found in Odoo.",
                    details={"product_id": product_id},
                )

            Warehouse = self.env["stock.warehouse"]
            warehouses = Warehouse.search([("active", "=", True)], order="sequence asc, id asc")
            if not warehouses:
                warehouses = Warehouse.search([], order="id asc")

            results: List[Dict[str, Any]] = []
            for wh in warehouses:
                wh_product = product.with_context(warehouse=wh.id)
                qty_avail = float(getattr(wh_product, "free_qty", getattr(wh_product, "qty_available", 0.0)))
                qty_res = float(getattr(wh_product, "outgoing_qty", 0.0))
                qty_inc = float(getattr(wh_product, "incoming_qty", 0.0))
                results.append({
                    "warehouse_id": wh.id,
                    "warehouse_name": wh.name,
                    "qty_available": max(0.0, qty_avail),
                    "qty_reserved": max(0.0, qty_res),
                    "qty_incoming": max(0.0, qty_inc),
                })
            return results

        # Standalone / In-memory execution
        sorted_warehouses = sorted(self._warehouses, key=lambda w: (w.get("sequence", 999), w["warehouse_id"]))
        results: List[Dict[str, Any]] = []

        product_stock = self._stock_store.get(product_id, {})
        for wh in sorted_warehouses:
            wh_id = wh["warehouse_id"]
            levels = product_stock.get(wh_id, {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0})
            results.append({
                "warehouse_id": wh_id,
                "warehouse_name": wh["warehouse_name"],
                "qty_available": float(levels.get("qty_available", 0.0)),
                "qty_reserved": float(levels.get("qty_reserved", 0.0)),
                "qty_incoming": float(levels.get("qty_incoming", 0.0)),
            })
        return results

    def get_open_pickings(self, order_id: int) -> List[Dict[str, Any]]:
        """Retrieve open stock pickings associated with a sale order.

        :param order_id: Odoo sale.order ID.
        :return: List of open pickings with warehouse, state, and batch details.
        :raises ValidationError: If order_id is not a positive integer.
        :raises NotFoundError: If order is not found.
        """
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(
                f"Invalid order_id: {order_id}. Must be a positive integer.",
                details={"order_id": order_id},
            )

        if self.env is not None:
            SaleOrder = self.env["sale.order"]
            order = SaleOrder.browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found in Odoo.",
                    details={"order_id": order_id},
                )

            if hasattr(order.picking_ids, "filtered"):
                open_pickings = order.picking_ids.filtered(lambda p: p.state not in ("done", "cancel"))
            else:
                open_pickings = [p for p in order.picking_ids if getattr(p, "state", "") not in ("done", "cancel")]
            results: List[Dict[str, Any]] = []
            for picking in open_pickings:
                wh_id = None
                wh_name = None
                if picking.picking_type_id and picking.picking_type_id.warehouse_id:
                    wh_id = picking.picking_type_id.warehouse_id.id
                    wh_name = picking.picking_type_id.warehouse_id.name

                results.append({
                    "picking_id": picking.id,
                    "name": picking.name,
                    "state": picking.state,
                    "warehouse_id": wh_id,
                    "warehouse_name": wh_name,
                    "origin": picking.origin,
                    "dealflow_fulfillment_batch_id": getattr(picking, "dealflow_fulfillment_batch_id", None) or None,
                    "dealflow_warehouse_split": bool(getattr(picking, "dealflow_warehouse_split", False)),
                    "dealflow_split_details": getattr(picking, "dealflow_split_details", None) or None,
                })
            return results

        # Standalone / In-memory execution
        if order_id not in self._orders:
            raise NotFoundError(
                f"Sale order with ID {order_id} not found in adapter registry.",
                details={"order_id": order_id},
            )

        results = [
            dict(p) for p in self._pickings
            if p["order_id"] == order_id and p.get("state") not in ("done", "cancel")
        ]
        return results

    def calculate_fulfillment_split(
        self,
        order_id: int,
        product_id: int,
        requested_qty: float,
    ) -> FulfillmentPlanDTO:
        """Calculate optimal multi-warehouse fulfillment allocations in priority order.

        Iterates warehouses in sequence (e.g. WH1 Main, WH2 East, WH3 West).
        If WH1 has 9 and requested is 15, allocates 9 from WH1 and 6 from WH2.

        :param order_id: Odoo sale.order ID.
        :param product_id: Odoo product.product ID.
        :param requested_qty: Requested units to fulfill. Must be > 0.
        :return: FulfillmentPlanDTO with multi-warehouse split allocations.
        :raises ValidationError: If parameters are invalid or total stock is insufficient.
        """
        # Validate inputs
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(
                f"Invalid order_id: {order_id}. Must be a positive integer.",
                details={"order_id": order_id},
            )
        if not isinstance(product_id, int) or product_id <= 0:
            raise ValidationError(
                f"Invalid product_id: {product_id}. Must be a positive integer.",
                details={"product_id": product_id},
            )
        if not isinstance(requested_qty, (int, float)) or requested_qty <= 0:
            raise ValidationError(
                f"Requested quantity must be greater than zero, received: {requested_qty}.",
                details={"requested_qty": requested_qty},
            )

        requested_qty = float(requested_qty)
        warehouses = self.get_warehouse_stock(product_id)
        total_available = sum(wh["qty_available"] for wh in warehouses)

        # Stock availability check across all warehouses
        if requested_qty > total_available:
            raise ValidationError(
                f"Insufficient inventory across all warehouses for product {product_id}. "
                f"Requested: {requested_qty}, Total Available: {total_available}. "
                f"Shortfall: {round(requested_qty - total_available, 4)}.",
                details={
                    "order_id": order_id,
                    "product_id": product_id,
                    "requested_qty": requested_qty,
                    "total_available": total_available,
                    "shortfall": round(requested_qty - total_available, 4),
                },
            )

        remaining_qty = requested_qty
        allocations: List[FulfillmentSplitItem] = []

        # Greedy allocation in warehouse priority order
        for wh in warehouses:
            available = float(wh["qty_available"])
            if available <= 0.0:
                continue

            take_qty = min(available, remaining_qty)
            allocations.append(
                FulfillmentSplitItem(
                    product_id=product_id,
                    warehouse_id=wh["warehouse_id"],
                    warehouse_name=wh["warehouse_name"],
                    quantity=round(take_qty, 4),
                )
            )
            remaining_qty -= take_qty
            if remaining_qty <= 1e-6:
                remaining_qty = 0.0
                break

        # Comprehensive validation: sum of allocations must equal requested quantity
        allocated_sum = round(sum(item.quantity for item in allocations), 4)
        if abs(allocated_sum - requested_qty) > 1e-4:
            raise ValidationError(
                f"Fulfillment allocation sum ({allocated_sum}) does not match requested quantity ({requested_qty}).",
                details={
                    "requested_qty": requested_qty,
                    "allocated_sum": allocated_sum,
                    "discrepancy": round(requested_qty - allocated_sum, 4),
                },
            )

        # Generate descriptive fulfillment notes
        is_split = len(allocations) > 1
        if is_split:
            alloc_summary = ", ".join(f"{item.warehouse_name}: {item.quantity}" for item in allocations)
            notes = f"Multi-warehouse split shipment ({len(allocations)} warehouses): {alloc_summary}"
        else:
            notes = f"Direct fulfillment from {allocations[0].warehouse_name} ({allocations[0].quantity} units)"

        return FulfillmentPlanDTO(
            deal_id=None,
            order_id=order_id,
            allocations=allocations,
            notes=notes,
            requested_qty=requested_qty,
        )

    def apply_fulfillment_plan(
        self,
        order_id: int,
        fulfillment_plan: FulfillmentPlanDTO,
        batch_id: Optional[str] = None,
        idempotent: bool = False,
    ) -> Dict[str, Any]:
        """Atomically execute a multi-warehouse fulfillment plan in Odoo.

        - Validates order state (rejects cancelled and already delivered orders).
        - Validates all allocations against live warehouse stock.
        - Enforces strict protection against tampered plan quantities.
        - Enforces idempotency and duplicate protection for fulfillment batches.
        - Records batch ID, split flag, and allocation details on stock pickings.
        - Returns execution status and created/updated picking IDs.

        :param order_id: Odoo sale.order ID.
        :param fulfillment_plan: FulfillmentPlanDTO containing split allocations.
        :param batch_id: Optional specific batch ID to assign. If already executed, triggers duplicate protection.
        :param idempotent: If True, duplicate batch execution returns existing status idempotently instead of raising.
        :return: Execution summary dictionary.
        :raises ValidationError: If parameters or allocation data are invalid or tampered.
        :raises InvalidStateError: On stock violations, cancelled/delivered order state, or duplicate execution.
        :raises NotFoundError: If order or warehouse does not exist.
        """
        # 1. Parameter validations
        if not isinstance(order_id, int) or order_id <= 0:
            raise ValidationError(
                f"Invalid order_id: {order_id}. Must be a positive integer.",
                details={"order_id": order_id},
            )

        if not isinstance(fulfillment_plan, FulfillmentPlanDTO):
            raise ValidationError(
                "fulfillment_plan must be an instance of FulfillmentPlanDTO.",
                details={"type_received": type(fulfillment_plan).__name__},
            )

        if fulfillment_plan.order_id != order_id:
            raise ValidationError(
                f"Order ID mismatch: parameter order_id ({order_id}) != plan.order_id ({fulfillment_plan.order_id}).",
                details={"order_id": order_id, "plan_order_id": fulfillment_plan.order_id},
            )

        if not fulfillment_plan.allocations:
            raise ValidationError(
                "Fulfillment plan must contain at least one warehouse allocation.",
                details={"order_id": order_id},
            )

        total_plan_qty = sum(item.quantity for item in fulfillment_plan.allocations)
        if total_plan_qty <= 0:
            raise ValidationError(
                f"Total fulfillment quantity must be greater than zero, got {total_plan_qty}.",
                details={"total_plan_qty": total_plan_qty},
            )

        for alloc in fulfillment_plan.allocations:
            if not isinstance(alloc.warehouse_id, int) or alloc.warehouse_id <= 0:
                raise ValidationError(
                    f"Invalid warehouse_id {alloc.warehouse_id} in fulfillment allocation.",
                    details={"allocation": str(alloc)},
                )
            if alloc.quantity <= 0:
                raise ValidationError(
                    f"Allocation quantity must be greater than zero, got {alloc.quantity} for warehouse {alloc.warehouse_name}.",
                    details={"allocation": str(alloc)},
                )

        # 2. Strict tampering verification: sum of allocations != requested qty
        if fulfillment_plan.requested_qty is not None:
            if abs(total_plan_qty - fulfillment_plan.requested_qty) > 1e-4:
                raise ValidationError(
                    f"Tampered fulfillment plan: sum of allocation quantities ({total_plan_qty}) "
                    f"does not match requested quantity ({fulfillment_plan.requested_qty}).",
                    details={
                        "order_id": order_id,
                        "requested_qty": fulfillment_plan.requested_qty,
                        "total_plan_qty": total_plan_qty,
                        "discrepancy": round(total_plan_qty - fulfillment_plan.requested_qty, 4),
                    },
                )

        # 3. Order existence and state validation (Cancel / Done rejection)
        order: Any = None
        if self.env is not None:
            SaleOrder = self.env["sale.order"]
            order = SaleOrder.browse(order_id)
            if not order.exists():
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found in Odoo.",
                    details={"order_id": order_id},
                )
            order_state = getattr(order, "state", "")
            if order_state in ("cancel", "done"):
                state_desc = "cancelled" if order_state == "cancel" else "already delivered (done)"
                raise InvalidStateError(
                    f"Cannot apply fulfillment plan to {state_desc} sale order {order_id}.",
                    details={"order_id": order_id, "state": order_state},
                )
        else:
            if order_id not in self._orders:
                raise NotFoundError(
                    f"Sale order with ID {order_id} not found in adapter registry.",
                    details={"order_id": order_id},
                )
            order = self._orders[order_id]
            order_state = order.get("state")
            if order_state in ("cancel", "done"):
                state_desc = "cancelled" if order_state == "cancel" else "already delivered (done)"
                raise InvalidStateError(
                    f"Cannot apply fulfillment plan to {state_desc} sale order {order_id}.",
                    details={"order_id": order_id, "state": order_state},
                )

        # 4. Resolve fulfillment batch ID & enforce duplicate protection / idempotency
        target_batch_id = batch_id or fulfillment_plan.batch_id
        if not target_batch_id:
            unique_token = uuid.uuid4().hex[:6].upper()
            target_batch_id = f"BATCH-SO{order_id}-{int(time.time())}-{unique_token}"
            fulfillment_plan.batch_id = target_batch_id

        # Check if this batch ID has already been applied
        existing_picking_ids: List[int] = []
        if self.env is not None:
            existing_pickings = self.env["stock.picking"].search([
                ("dealflow_fulfillment_batch_id", "=", target_batch_id)
            ])
            existing_picking_ids = [p.id for p in existing_pickings if hasattr(p, "id")]
        else:
            existing_picking_ids = [
                p["picking_id"] for p in self._pickings
                if p.get("dealflow_fulfillment_batch_id") == target_batch_id
            ]

        if existing_picking_ids:
            if not idempotent:
                raise InvalidStateError(
                    f"Duplicate fulfillment plan execution: Batch '{target_batch_id}' has already been processed for order {order_id}.",
                    details={
                        "order_id": order_id,
                        "batch_id": target_batch_id,
                        "existing_picking_ids": existing_picking_ids,
                    },
                )
            return {
                "success": True,
                "status": "already_applied",
                "order_id": order_id,
                "dealflow_fulfillment_batch_id": target_batch_id,
                "picking_ids": existing_picking_ids,
                "is_split": len(fulfillment_plan.allocations) > 1,
                "total_allocated": round(total_plan_qty, 4),
                "duplicate_prevented": True,
                "message": f"Fulfillment batch '{target_batch_id}' was already executed; idempotent return without duplicate pickings.",
            }

        # 5. Live stock validation across all allocations prior to state mutation (TOCTOU defense)
        for alloc in fulfillment_plan.allocations:
            wh_stock = self._get_warehouse_stock_single(alloc.product_id, alloc.warehouse_id)
            if not wh_stock:
                raise NotFoundError(
                    f"Warehouse ID {alloc.warehouse_id} ({alloc.warehouse_name}) not found for product {alloc.product_id}.",
                    details={"warehouse_id": alloc.warehouse_id, "product_id": alloc.product_id},
                )
            current_avail = wh_stock.get("qty_available", 0.0)
            if current_avail < alloc.quantity:
                raise InvalidStateError(
                    f"Stock violation: Warehouse '{alloc.warehouse_name}' (ID {alloc.warehouse_id}) "
                    f"has insufficient stock ({current_avail}) to fulfill requested allocation of {alloc.quantity} units.",
                    details={
                        "product_id": alloc.product_id,
                        "warehouse_id": alloc.warehouse_id,
                        "warehouse_name": alloc.warehouse_name,
                        "qty_available": current_avail,
                        "required_qty": alloc.quantity,
                        "shortfall": round(alloc.quantity - current_avail, 4),
                    },
                )

        is_split = len(fulfillment_plan.allocations) > 1
        split_details_payload = json.dumps([
            {
                "warehouse_id": a.warehouse_id,
                "warehouse_name": a.warehouse_name,
                "product_id": a.product_id,
                "quantity": a.quantity,
            }
            for a in fulfillment_plan.allocations
        ])

        created_picking_ids: List[int] = []

        # 6. Atomic Execution Mode: Odoo ORM (with self.env.cr.savepoint)
        if self.env is not None:
            with self.env.cr.savepoint():
                # Check existing open pickings; cancel them if performing multi-warehouse split
                if hasattr(order.picking_ids, "filtered"):
                    open_pickings = order.picking_ids.filtered(lambda p: p.state not in ("done", "cancel"))
                else:
                    open_pickings = [p for p in order.picking_ids if getattr(p, "state", "") not in ("done", "cancel")]
                if open_pickings and is_split:
                    for p in open_pickings:
                        p.action_cancel()

                StockPicking = self.env["stock.picking"]
                StockMove = self.env["stock.move"]
                StockWarehouse = self.env["stock.warehouse"]

                for alloc in fulfillment_plan.allocations:
                    wh = StockWarehouse.browse(alloc.warehouse_id)
                    product = self.env["product.product"].browse(alloc.product_id)
                    picking_type = wh.out_type_id

                    partner_shipping = order.partner_shipping_id or order.partner_id
                    dest_location_id = (
                        partner_shipping.property_stock_customer.id
                        if hasattr(partner_shipping, "property_stock_customer") and partner_shipping.property_stock_customer
                        else self.env.ref("stock.stock_location_customers").id
                    )

                    picking_vals = {
                        "partner_id": partner_shipping.id,
                        "picking_type_id": picking_type.id,
                        "location_id": picking_type.default_location_src_id.id or wh.lot_stock_id.id,
                        "location_dest_id": dest_location_id,
                        "origin": order.name,
                        "dealflow_fulfillment_batch_id": target_batch_id,
                        "dealflow_warehouse_split": is_split,
                        "dealflow_split_details": split_details_payload,
                        "sale_id": order.id,
                    }
                    new_picking = StockPicking.create(picking_vals)

                    # Link sale line if present
                    if hasattr(order.order_line, "filtered"):
                        sale_line_res = order.order_line.filtered(lambda l: l.product_id.id == alloc.product_id)[:1]
                        sale_line_id = sale_line_res.id if sale_line_res else False
                    else:
                        matching_lines = [l for l in order.order_line if getattr(getattr(l, "product_id", None), "id", None) == alloc.product_id]
                        sale_line_id = getattr(matching_lines[0], "id", False) if matching_lines else False

                    move_vals = {
                        "name": f"{order.name} - {alloc.quantity} units from {wh.name}",
                        "product_id": product.id,
                        "product_uom_qty": alloc.quantity,
                        "product_uom": product.uom_id.id if hasattr(product, "uom_id") else 1,
                        "picking_id": new_picking.id,
                        "location_id": new_picking.location_id.id,
                        "location_dest_id": new_picking.location_dest_id.id,
                        "sale_line_id": sale_line_id,
                    }
                    StockMove.create(move_vals)
                    created_picking_ids.append(new_picking.id)

        # 7. Atomic Execution Mode: Standalone / In-Memory Store
        else:
            # Atomic reservation and picking generation
            for alloc in fulfillment_plan.allocations:
                # Deduct available, increase reserved
                wh_stock = self._stock_store[alloc.product_id][alloc.warehouse_id]
                wh_stock["qty_available"] = round(wh_stock["qty_available"] - alloc.quantity, 4)
                wh_stock["qty_reserved"] = round(wh_stock.get("qty_reserved", 0.0) + alloc.quantity, 4)

                # Create picking record
                picking_id = self._next_picking_id
                self._next_picking_id += 1

                picking_record = {
                    "picking_id": picking_id,
                    "name": f"WH/{alloc.warehouse_name[:4].replace(' ', '').upper()}/OUT/{order_id:04d}-{picking_id}",
                    "order_id": order_id,
                    "warehouse_id": alloc.warehouse_id,
                    "warehouse_name": alloc.warehouse_name,
                    "location_id": alloc.warehouse_id * 10,
                    "location_dest_id": 5,
                    "origin": order.get("name", f"SO{order_id:04d}"),
                    "dealflow_fulfillment_batch_id": target_batch_id,
                    "dealflow_warehouse_split": is_split,
                    "dealflow_split_details": split_details_payload,
                    "product_id": alloc.product_id,
                    "quantity": alloc.quantity,
                    "state": "assigned",
                    "created_at": datetime.now().isoformat(),
                }
                self._pickings.append(picking_record)
                created_picking_ids.append(picking_id)

        return {
            "success": True,
            "status": "applied",
            "order_id": order_id,
            "dealflow_fulfillment_batch_id": target_batch_id,
            "picking_ids": created_picking_ids,
            "is_split": is_split,
            "total_allocated": round(total_plan_qty, 4),
            "allocations": [
                {
                    "product_id": a.product_id,
                    "warehouse_id": a.warehouse_id,
                    "warehouse_name": a.warehouse_name,
                    "quantity": a.quantity,
                }
                for a in fulfillment_plan.allocations
            ],
            "split_details": split_details_payload,
            "message": (
                f"Fulfillment plan executed successfully: {len(created_picking_ids)} picking(s) created "
                f"across {len(fulfillment_plan.allocations)} warehouse(s) under batch {target_batch_id}."
            ),
        }

