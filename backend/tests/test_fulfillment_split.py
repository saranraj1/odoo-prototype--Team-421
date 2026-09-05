"""Unit tests for GOV-07 Fulfillment Multi-Warehouse Planner."""

from app.governance.fulfillment.planner import FulfillmentPlanner
from app.governance.interfaces import WarehouseStock, InventoryProviderProtocol


class DummyInventoryProvider:
    def __init__(self, main_qty: float, east_qty: float):
        self.main_qty = main_qty
        self.east_qty = east_qty

    def get_stock_for_products(self, product_ids):
        return {
            72: [  # Laptop Pro
                WarehouseStock(
                    odoo_warehouse_id=1,
                    warehouse_name="Main Warehouse",
                    quantity_available=self.main_qty,
                    is_primary=True,
                    shipping_cost_unit=500.0,
                ),
                WarehouseStock(
                    odoo_warehouse_id=2,
                    warehouse_name="East Depot",
                    quantity_available=self.east_qty,
                    is_primary=False,
                    shipping_cost_unit=750.0,
                ),
            ]
        }


def test_split_across_two_warehouses(sample_gold_deal):
    """Demand = 10; Main = 9, East = 6 -> Split 9 from Main, 1 from East, 0 backorder."""
    provider = DummyInventoryProvider(main_qty=9.0, east_qty=6.0)
    planner = FulfillmentPlanner(inventory_provider=provider)

    result = planner.plan_fulfillment(sample_gold_deal)

    assert result.split_required is True
    assert result.total_requested_qty == 10.0
    assert result.total_allocated_qty == 10.0
    assert result.total_backorder_qty == 0.0
    assert result.estimated_shipments == 2

    laptop_plan = result.line_plans[0]
    assert len(laptop_plan.allocations) == 2
    assert laptop_plan.allocations[0].warehouse_name == "Main Warehouse"
    assert laptop_plan.allocations[0].quantity == 9.0
    assert laptop_plan.allocations[1].warehouse_name == "East Depot"
    assert laptop_plan.allocations[1].quantity == 1.0


def test_single_primary_warehouse_full_fulfillment(sample_gold_deal):
    """Demand = 10; Main = 15, East = 6 -> 10 from Main, 0 split, 1 shipment."""
    provider = DummyInventoryProvider(main_qty=15.0, east_qty=6.0)
    planner = FulfillmentPlanner(inventory_provider=provider)

    result = planner.plan_fulfillment(sample_gold_deal)

    assert result.split_required is False
    assert result.total_allocated_qty == 10.0
    assert result.total_backorder_qty == 0.0
    assert result.estimated_shipments == 1

    laptop_plan = result.line_plans[0]
    assert len(laptop_plan.allocations) == 1
    assert laptop_plan.allocations[0].warehouse_name == "Main Warehouse"
    assert laptop_plan.allocations[0].quantity == 10.0


def test_stock_deficit_produces_backorder(sample_gold_deal):
    """Demand = 10; Main = 4, East = 3 -> Allocates 7, Backorder = 3."""
    provider = DummyInventoryProvider(main_qty=4.0, east_qty=3.0)
    planner = FulfillmentPlanner(inventory_provider=provider)

    result = planner.plan_fulfillment(sample_gold_deal)

    assert result.total_requested_qty == 10.0
    assert result.total_allocated_qty == 7.0
    assert result.total_backorder_qty == 3.0
    # Invariant: allocated + backorder == requested
    assert result.total_allocated_qty + result.total_backorder_qty == result.total_requested_qty


def test_zero_stock_all_backorder(sample_gold_deal):
    """Demand = 10; Main = 0, East = 0 -> 0 allocated, 10 backorder."""
    provider = DummyInventoryProvider(main_qty=0.0, east_qty=0.0)
    planner = FulfillmentPlanner(inventory_provider=provider)

    result = planner.plan_fulfillment(sample_gold_deal)

    assert result.total_allocated_qty == 0.0
    assert result.total_backorder_qty == 10.0
    assert result.total_allocated_qty + result.total_backorder_qty == 10.0
