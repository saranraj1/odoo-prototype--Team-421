# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Inventory & Multi-Warehouse Fulfillment Test Suite.

Verifies:
- Aggregated stock availability inspection across all active warehouses
- Granular per-warehouse inventory breakdown retrieval
- Greedy priority-based fulfillment plan generation
- Warehouse split scenario (Laptop requested: 15 units -> WH1: 9 units, WH2: 6 units)
- Direct single-warehouse fulfillment when stock is sufficient
- Shortfall detection and error reporting when requested quantity exceeds total stock
- Atomic execution of multi-warehouse fulfillment plan in Odoo
- Generation of stock pickings stamped with dealflow_fulfillment_batch_id and split flags
"""

from __future__ import annotations

import pytest

from dealflow_odoo.schemas import (
    FulfillmentPlanDTO,
    FulfillmentSplitItem,
    InvalidStateError,
    NotFoundError,
    ValidationError,
)


class TestInventoryFulfillment:
    """Test suite for InventoryAdapter multi-warehouse operations."""

    def test_get_available_stock_aggregated(self, inventory_adapter):
        """Tests reading total on-hand stock aggregated across all warehouses."""
        # Laptop (9 in WH1 + 6 in WH2 = 15 total)
        avail = inventory_adapter.get_available_stock(1)
        assert avail == 15.0

        # Non-existent product
        with pytest.raises(NotFoundError):
            inventory_adapter.get_available_stock(9999)

        # Invalid product_id parameter
        with pytest.raises(ValidationError):
            inventory_adapter.get_available_stock(-1)
        with pytest.raises(ValidationError):
            inventory_adapter.get_available_stock("invalid_id")  # type: ignore

    def test_get_warehouse_stock_breakdown(self, inventory_adapter):
        """Tests per-warehouse stock availability breakdown."""
        wh_stocks = inventory_adapter.get_warehouse_stock(1)
        assert len(wh_stocks) >= 2

        wh_map = {item["warehouse_name"]: item["qty_available"] for item in wh_stocks}
        assert wh_map["WH1 Main"] == 9.0
        assert wh_map["WH2 East"] == 6.0

    def test_calculate_fulfillment_split_exact_multi_warehouse(self, inventory_adapter):
        """Tests split calculation for 15 laptops: allocates 9 from WH1 and 6 from WH2."""
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=1,
            product_id=1,
            requested_qty=15.0,
        )
        assert isinstance(plan, FulfillmentPlanDTO)
        assert plan.order_id == 1
        assert len(plan.allocations) == 2

        # Priority 1: WH1 Main
        alloc1 = plan.allocations[0]
        assert alloc1.warehouse_name == "WH1 Main"
        assert alloc1.quantity == 9.0

        # Priority 2: WH2 East
        alloc2 = plan.allocations[1]
        assert alloc2.warehouse_name == "WH2 East"
        assert alloc2.quantity == 6.0

        # Total allocated matches requested
        total_allocated = sum(a.quantity for a in plan.allocations)
        assert total_allocated == 15.0
        assert "Multi-warehouse split shipment" in (plan.notes or "")

    def test_calculate_fulfillment_single_warehouse(self, inventory_adapter):
        """Tests single-warehouse allocation when primary warehouse has sufficient stock."""
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=1,
            product_id=1,
            requested_qty=5.0,
        )
        assert isinstance(plan, FulfillmentPlanDTO)
        assert len(plan.allocations) == 1
        assert plan.allocations[0].warehouse_name == "WH1 Main"
        assert plan.allocations[0].quantity == 5.0
        assert "Direct fulfillment" in (plan.notes or "")

    def test_calculate_fulfillment_split_insufficient_stock_error(self, inventory_adapter):
        """Tests shortfall validation error when requested quantity exceeds total stock."""
        # Total available is 15; request 20
        with pytest.raises(ValidationError) as exc_info:
            inventory_adapter.calculate_fulfillment_split(
                order_id=1,
                product_id=1,
                requested_qty=20.0,
            )
        err = exc_info.value
        assert "Insufficient inventory" in err.message
        assert err.details.get("shortfall") == 5.0
        assert err.details.get("total_available") == 15.0

    def test_apply_fulfillment_plan_execution(self, inventory_adapter, sample_quotation):
        """Tests atomic fulfillment plan execution: creates pickings with batch ID and split flags."""
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=15.0,
        )

        res = inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)
        assert res["success"] is True
        assert res["status"] == "applied"
        assert res["is_split"] is True
        assert res["total_allocated"] == 15.0
        assert "BATCH-SO" in res["dealflow_fulfillment_batch_id"]
        assert len(res["picking_ids"]) == 2

        # Query open pickings
        open_pickings = inventory_adapter.get_open_pickings(sample_quotation.id)
        assert len(open_pickings) >= 2
        for p in open_pickings:
            assert p["dealflow_fulfillment_batch_id"] == res["dealflow_fulfillment_batch_id"]
            assert p["dealflow_warehouse_split"] is True

    def test_apply_fulfillment_plan_stock_violation_error(self, inventory_adapter, sample_quotation):
        """Tests stock validation error when attempting to allocate more than available in a warehouse."""
        # WH1 only has 9 units, plan erroneously claims 15 units from WH1
        invalid_plan = FulfillmentPlanDTO(
            deal_id="DEAL-OVERALLOC",
            order_id=sample_quotation.id,
            allocations=[
                FulfillmentSplitItem(
                    product_id=1,
                    warehouse_id=1,
                    warehouse_name="WH1 Main",
                    quantity=15.0,
                )
            ],
            notes="Overallocated plan",
        )

        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, invalid_plan)

        assert "Stock violation" in str(exc_info.value)

    def test_apply_fulfillment_plan_cancelled_order_error(self, inventory_adapter, sample_quotation):
        """Tests that fulfillment cannot be applied to a cancelled sale order."""
        sample_quotation.state = "cancel"

        plan = FulfillmentPlanDTO(
            deal_id="DEAL-CANCEL",
            order_id=sample_quotation.id,
            allocations=[
                FulfillmentSplitItem(
                    product_id=1,
                    warehouse_id=1,
                    warehouse_name="WH1 Main",
                    quantity=5.0,
                )
            ],
        )

        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        assert "cancelled" in str(exc_info.value)
