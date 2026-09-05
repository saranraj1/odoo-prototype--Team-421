"""Fulfillment Multi-Warehouse Planner (GOV-07).

Implements deterministic greedy stock allocation across warehouses.
Maintains invariant: allocated_qty + backorder_qty == requested_qty.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from ..context import DealContext, DealLineContext
from ..interfaces import WarehouseStock, InventoryProviderProtocol, MockInventoryProvider


class WarehouseAllocation(BaseModel):
    """Allocation of product quantity from a specific warehouse."""
    odoo_warehouse_id: int
    warehouse_name: str
    quantity: float
    source_stock: float = Field(default=0.0, description="Available stock at warehouse prior to allocation")
    remaining_stock: float = Field(default=0.0, description="Remaining unallocated stock at warehouse")
    shipping_cost: float = 0.0


class LineFulfillmentPlan(BaseModel):
    """Fulfillment allocation for a single deal line item."""
    odoo_line_id: int
    odoo_product_id: int
    product_name: str
    requested_qty: float
    allocated_qty: float = 0.0
    backorder_qty: float = 0.0
    allocations: List[WarehouseAllocation] = Field(default_factory=list)


class FulfillmentPlanResult(BaseModel):
    """Complete order fulfillment allocation result."""
    split_required: bool = False
    total_requested_qty: float = 0.0
    total_allocated_qty: float = 0.0
    total_backorder_qty: float = 0.0
    estimated_shipments: int = 1
    estimated_shipping_cost: float = 0.0
    line_plans: List[LineFulfillmentPlan] = Field(default_factory=list)
    allocations_summary: List[Dict[str, Any]] = Field(default_factory=list)


class FulfillmentPlanner:
    """Greedy multi-warehouse fulfillment allocator."""

    def __init__(self, inventory_provider: Optional[InventoryProviderProtocol] = None):
        self.inventory_provider = inventory_provider or MockInventoryProvider()

    def plan_fulfillment(self, context: DealContext) -> FulfillmentPlanResult:
        """Plan inventory allocation across warehouses for all deal lines."""
        product_ids = [l.odoo_product_id for l in context.lines if not l.is_recurring]
        stock_data = self.inventory_provider.get_stock_for_products(product_ids)

        line_plans: List[LineFulfillmentPlan] = []
        warehouses_used: set[int] = set()
        total_requested = 0.0
        total_allocated = 0.0
        total_backorder = 0.0
        total_shipping_cost = 0.0
        split_required = False

        for line in context.lines:
            # Skip recurring / service lines from physical stock allocation
            if line.is_recurring or line.category_name.lower() in ("services", "software"):
                continue

            req_qty = max(0.0, float(line.quantity))
            total_requested += req_qty
            remaining_demand = req_qty
            line_allocations: List[WarehouseAllocation] = []

            # Retrieve warehouses with stock, deduplicate by warehouse ID
            raw_wh_stocks = stock_data.get(line.odoo_product_id, [])
            dedup_wh: Dict[int, WarehouseStock] = {}
            for w in raw_wh_stocks:
                if w.odoo_warehouse_id in dedup_wh:
                    # Aggregate quantity if duplicate warehouse entry exists
                    existing = dedup_wh[w.odoo_warehouse_id]
                    dedup_wh[w.odoo_warehouse_id] = WarehouseStock(
                        odoo_warehouse_id=w.odoo_warehouse_id,
                        warehouse_name=w.warehouse_name,
                        quantity_available=existing.quantity_available + w.quantity_available,
                        shipping_cost_unit=w.shipping_cost_unit,
                        is_primary=existing.is_primary or w.is_primary
                    )
                else:
                    dedup_wh[w.odoo_warehouse_id] = w

            # Greedy allocation: Primary first, highest available stock next, deterministic ID tie-break
            wh_stocks = sorted(
                dedup_wh.values(),
                key=lambda w: (not w.is_primary, -w.quantity_available, w.odoo_warehouse_id)
            )

            for wh in wh_stocks:
                if remaining_demand <= 0:
                    break

                alloc_qty = min(remaining_demand, max(0.0, wh.quantity_available))
                if alloc_qty > 0:
                    cost = round(alloc_qty * wh.shipping_cost_unit, 2)
                    rem_stock = round(wh.quantity_available - alloc_qty, 2)
                    line_allocations.append(
                        WarehouseAllocation(
                            odoo_warehouse_id=wh.odoo_warehouse_id,
                            warehouse_name=wh.warehouse_name,
                            quantity=alloc_qty,
                            source_stock=wh.quantity_available,
                            remaining_stock=rem_stock,
                            shipping_cost=cost
                        )
                    )
                    warehouses_used.add(wh.odoo_warehouse_id)
                    total_shipping_cost += cost
                    remaining_demand -= alloc_qty

            allocated_line_qty = round(req_qty - remaining_demand, 4)
            backorder_line_qty = round(max(0.0, remaining_demand), 4)

            # Invariant check: allocated + backorder == requested
            assert round(allocated_line_qty + backorder_line_qty, 4) == round(req_qty, 4), \
                f"Fulfillment invariant violated for {line.product_name}"

            if len(line_allocations) > 1:
                split_required = True

            total_allocated += allocated_line_qty
            total_backorder += backorder_line_qty

            line_plans.append(
                LineFulfillmentPlan(
                    odoo_line_id=line.odoo_line_id,
                    odoo_product_id=line.odoo_product_id,
                    product_name=line.product_name,
                    requested_qty=req_qty,
                    allocated_qty=allocated_line_qty,
                    backorder_qty=backorder_line_qty,
                    allocations=line_allocations
                )
            )

        if len(warehouses_used) > 1:
            split_required = True

        shipment_count = max(1, len(warehouses_used))
        if total_backorder > 0:
            shipment_count += 1  # Additional shipment for future backorder release

        # Create consolidated allocations summary for UI
        alloc_summary_dict: Dict[str, Dict[str, Any]] = {}
        for lp in line_plans:
            for al in lp.allocations:
                if al.warehouse_name not in alloc_summary_dict:
                    alloc_summary_dict[al.warehouse_name] = {
                        "warehouse_name": al.warehouse_name,
                        "odoo_warehouse_id": al.odoo_warehouse_id,
                        "quantity": 0.0
                    }
                alloc_summary_dict[al.warehouse_name]["quantity"] += al.quantity

        return FulfillmentPlanResult(
            split_required=split_required,
            total_requested_qty=total_requested,
            total_allocated_qty=total_allocated,
            total_backorder_qty=total_backorder,
            estimated_shipments=shipment_count,
            estimated_shipping_cost=round(total_shipping_cost, 2),
            line_plans=line_plans,
            allocations_summary=list(alloc_summary_dict.values())
        )
