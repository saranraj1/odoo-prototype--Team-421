# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Stress & Adversarial Test Suite for Inventory & Fulfillment.

Executed by PRINCIPAL STRESS TESTER 2: INVENTORY & MULTI-WAREHOUSE ADVERSARIAL TESTER.

Target Subsystem:
- dealflow_odoo/services/inventory_adapter.py (InventoryAdapter)
- dealflow_odoo/models/stock_picking.py (StockPicking model extension)
- dealflow_odoo/schemas.py (FulfillmentPlanDTO, FulfillmentSplitItem, error contracts)

Attack Vectors Executed:
1. Zero Stock & Shortfall Scenarios:
   - Product has 0 stock across all warehouses -> verify ValidationError with detailed shortfall.
   - Requested quantity exceeds sum of all warehouses (e.g., requested 50, WH1: 9, WH2: 6, total: 15).
   - Fractional inventory precision & shortfall calculation.
   - Zero, negative, and invalid requested quantities and product IDs.
2. Complex Multi-Warehouse Splits:
   - 4-warehouse topology: WH1 (5), WH2 (5), WH3 (5), WH4 (5). Request 18 -> verify 4-way allocation (5+5+5+3).
   - Skewed stock: WH1 has 0, WH2 has 20. Request 10 -> verify WH1 is skipped and 10 allocated cleanly from WH2.
   - Priority routing order determined strictly by sequence, not warehouse ID.
3. Adversarial State Violations:
   - TOCTOU (Time-of-Check to Time-of-Use) stock depletion race between plan generation and execution.
   - Applying fulfillment plan to cancelled sale order -> verify InvalidStateError.
   - Applying fulfillment plan to already delivered/done sale order -> verify InvalidStateError.
   - Plan with tampered quantities (sum of allocations != requested qty) -> verify strict ValidationError.
   - Applying fulfillment plan twice with same batch ID -> verify duplicate protection (InvalidStateError) and idempotency mode.
4. Data Integrity & Stock Picking Model Extension:
   - Correct warehouse IDs, source locations, customer destination locations, and batch metadata.
   - StockPicking.get_split_details_dict() audit parsing (valid, malformed, empty).
   - StockPicking.action_view_batch_pickings() window action and domain targeting batch ID.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
import pytest

from dealflow_odoo.schemas import (
    FulfillmentPlanDTO,
    FulfillmentSplitItem,
    InvalidStateError,
    NotFoundError,
    ValidationError,
)
from dealflow_odoo.services.inventory_adapter import InventoryAdapter
from dealflow_odoo.models.stock_picking import StockPicking


# =============================================================================
# HELPER FIXTURES & BUILDERS
# =============================================================================

@pytest.fixture
def standalone_empty_adapter() -> InventoryAdapter:
    """Fixture providing a fresh standalone adapter with 0 initial inventory."""
    return InventoryAdapter(
        env=None,
        warehouse_data=[
            {"warehouse_id": 1, "warehouse_name": "WH1 Main", "code": "WH1", "sequence": 1},
            {"warehouse_id": 2, "warehouse_name": "WH2 East", "code": "WH2", "sequence": 2},
            {"warehouse_id": 3, "warehouse_name": "WH3 West", "code": "WH3", "sequence": 3},
        ],
        stock_data={},
    )


@pytest.fixture
def standalone_4wh_adapter() -> InventoryAdapter:
    """Fixture providing a 4-warehouse topology: WH1 (5), WH2 (5), WH3 (5), WH4 (5)."""
    warehouses = [
        {"warehouse_id": 1, "warehouse_name": "WH1 Main", "code": "WH1", "sequence": 1},
        {"warehouse_id": 2, "warehouse_name": "WH2 East", "code": "WH2", "sequence": 2},
        {"warehouse_id": 3, "warehouse_name": "WH3 West", "code": "WH3", "sequence": 3},
        {"warehouse_id": 4, "warehouse_name": "WH4 North", "code": "WH4", "sequence": 4},
    ]
    adapter = InventoryAdapter(env=None, warehouse_data=warehouses, stock_data={})
    adapter.seed_inventory(
        product_id=1,
        warehouse_stocks={
            1: {"qty_available": 5.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            2: {"qty_available": 5.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            3: {"qty_available": 5.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            4: {"qty_available": 5.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
        },
    )
    adapter.register_order(order_id=401, name="SO0401", state="sale")
    return adapter


# =============================================================================
# ATTACK VECTOR 1: ZERO STOCK & SHORTFALL SCENARIOS
# =============================================================================

class TestZeroStockAndShortfallScenarios:
    """Stress tests verifying strict rejection and shortfall reporting under zero or insufficient stock."""

    def test_zero_stock_across_all_warehouses_standalone(self, standalone_empty_adapter: InventoryAdapter):
        """Attacks adapter with 0 stock across all warehouses: must raise ValidationError with exact shortfall."""
        # Product 99 exists in store with 0 stock in all warehouses
        standalone_empty_adapter.seed_inventory(
            product_id=99,
            warehouse_stocks={
                1: {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                2: {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                3: {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            },
        )
        standalone_empty_adapter.register_order(order_id=10, name="SO0010")

        total_avail = standalone_empty_adapter.get_available_stock(99)
        assert total_avail == 0.0

        with pytest.raises(ValidationError) as exc_info:
            standalone_empty_adapter.calculate_fulfillment_split(
                order_id=10,
                product_id=99,
                requested_qty=12.0,
            )

        err = exc_info.value
        assert "Insufficient inventory" in err.message
        assert err.details.get("shortfall") == 12.0
        assert err.details.get("total_available") == 0.0
        assert err.details.get("requested_qty") == 12.0

    def test_zero_stock_in_odoo_env_mode(self, mock_odoo_env: Any):
        """Tests 0 stock scenario in high-fidelity mock Odoo ORM environment."""
        # Warranty (product 6) has 0 inventory quants in seed data
        adapter = InventoryAdapter(env=mock_odoo_env)
        avail = adapter.get_available_stock(6)
        assert avail == 0.0

        with pytest.raises(ValidationError) as exc_info:
            adapter.calculate_fulfillment_split(
                order_id=1,
                product_id=6,
                requested_qty=5.0,
            )

        err = exc_info.value
        assert "Insufficient inventory" in err.message
        assert err.details.get("shortfall") == 5.0
        assert err.details.get("total_available") == 0.0

    def test_requested_quantity_exceeds_sum_of_all_warehouses(self, inventory_adapter: InventoryAdapter):
        """Attacks with requested quantity 50 when WH1 has 9 and WH2 has 6 (total 15).
        
        Verifies clear error and exact backorder shortage calculation: 50 - 15 = 35 shortfall.
        """
        wh_stocks = inventory_adapter.get_warehouse_stock(1)
        sum_avail = sum(w["qty_available"] for w in wh_stocks)
        assert sum_avail == 15.0

        with pytest.raises(ValidationError) as exc_info:
            inventory_adapter.calculate_fulfillment_split(
                order_id=1,
                product_id=1,
                requested_qty=50.0,
            )

        err = exc_info.value
        assert "Insufficient inventory" in err.message
        assert err.details.get("requested_qty") == 50.0
        assert err.details.get("total_available") == 15.0
        assert err.details.get("shortfall") == 35.0
        # Verify caller can compute backorder from details
        backorder_needed = err.details["requested_qty"] - err.details["total_available"]
        assert backorder_needed == 35.0

    def test_fractional_inventory_and_shortfall_precision(self, standalone_empty_adapter: InventoryAdapter):
        """Tests floating point / fractional inventory precision without rounding drift."""
        # WH1 has 3.25 units, WH2 has 4.5 units (total: 7.75)
        standalone_empty_adapter.seed_inventory(
            product_id=55,
            warehouse_stocks={
                1: {"qty_available": 3.25, "qty_reserved": 0.0, "qty_incoming": 0.0},
                2: {"qty_available": 4.50, "qty_reserved": 0.0, "qty_incoming": 0.0},
            },
        )
        standalone_empty_adapter.register_order(order_id=20, name="SO0020")

        # Request 10.5 units -> shortfall should be 10.5 - 7.75 = 2.75
        with pytest.raises(ValidationError) as exc_info:
            standalone_empty_adapter.calculate_fulfillment_split(
                order_id=20,
                product_id=55,
                requested_qty=10.5,
            )

        err = exc_info.value
        assert err.details.get("shortfall") == 2.75
        assert err.details.get("total_available") == 7.75

    def test_zero_negative_and_invalid_requested_quantities(self, inventory_adapter: InventoryAdapter):
        """Attacks with boundary values: 0, negative, None, and non-numeric requested_qty."""
        for invalid_qty in [0, 0.0, -1, -50.5, None, "ten"]:
            with pytest.raises(ValidationError):
                inventory_adapter.calculate_fulfillment_split(
                    order_id=1,
                    product_id=1,
                    requested_qty=invalid_qty,  # type: ignore
                )

    def test_invalid_and_nonexistent_product_ids(self, inventory_adapter: InventoryAdapter):
        """Attacks with negative, zero, non-integer, and non-existent product IDs."""
        for invalid_pid in [-1, 0, -999, "invalid_pid", None]:
            with pytest.raises(ValidationError):
                inventory_adapter.calculate_fulfillment_split(
                    order_id=1,
                    product_id=invalid_pid,  # type: ignore
                    requested_qty=5.0,
                )

        with pytest.raises(NotFoundError):
            inventory_adapter.calculate_fulfillment_split(
                order_id=1,
                product_id=999999,
                requested_qty=5.0,
            )


# =============================================================================
# ATTACK VECTOR 2: COMPLEX MULTI-WAREHOUSE SPLITS
# =============================================================================

class TestComplexMultiWarehouseSplits:
    """Stress tests verifying complex multi-warehouse split allocations and routing priority."""

    def test_four_warehouse_topology_split_standalone(self, standalone_4wh_adapter: InventoryAdapter):
        """Tests 4-warehouse topology: WH1 (5), WH2 (5), WH3 (5), WH4 (5). Request 18 units.
        
        Verifies greedy 4-way allocation:
        - WH1: 5.0
        - WH2: 5.0
        - WH3: 5.0
        - WH4: 3.0
        Sum = 18.0.
        """
        plan = standalone_4wh_adapter.calculate_fulfillment_split(
            order_id=401,
            product_id=1,
            requested_qty=18.0,
        )

        assert isinstance(plan, FulfillmentPlanDTO)
        assert plan.order_id == 401
        assert len(plan.allocations) == 4

        # Verify allocation per warehouse
        alloc_map = {a.warehouse_name: a.quantity for a in plan.allocations}
        assert alloc_map["WH1 Main"] == 5.0
        assert alloc_map["WH2 East"] == 5.0
        assert alloc_map["WH3 West"] == 5.0
        assert alloc_map["WH4 North"] == 3.0

        total_allocated = sum(a.quantity for a in plan.allocations)
        assert total_allocated == 18.0
        assert "Multi-warehouse split shipment (4 warehouses)" in (plan.notes or "")

    def test_four_warehouse_topology_split_and_execution_env(self, mock_odoo_env: Any, sample_quotation: Any):
        """Tests 4-warehouse topology in mock Odoo environment, verifying picking creation for all 4 warehouses."""
        Warehouse = mock_odoo_env["stock.warehouse"]
        Quant = mock_odoo_env["stock.quant"]
        Product = mock_odoo_env["product.product"]
        laptop = Product.browse(1)

        # Clear existing quants for laptop
        laptop_quants = Quant.search([("product_id.id", "=", 1)])
        for q in laptop_quants:
            q.quantity = 0.0

        # Create WH3 and WH4 in Odoo env
        wh1 = Warehouse.browse(1)
        wh2 = Warehouse.browse(2)
        wh3 = Warehouse.create({
            "id": 3,
            "name": "WH3 West",
            "code": "WH3",
            "sequence": 3,
            "active": True,
            "out_type_id": type("PickingType", (), {
                "id": 3,
                "warehouse_id": type("WH", (), {"id": 3, "name": "WH3 West"})(),
                "default_location_src_id": type("Loc", (), {"id": 30})(),
            })(),
            "lot_stock_id": type("Loc", (), {"id": 30})(),
        })
        wh4 = Warehouse.create({
            "id": 4,
            "name": "WH4 North",
            "code": "WH4",
            "sequence": 4,
            "active": True,
            "out_type_id": type("PickingType", (), {
                "id": 4,
                "warehouse_id": type("WH", (), {"id": 4, "name": "WH4 North"})(),
                "default_location_src_id": type("Loc", (), {"id": 40})(),
            })(),
            "lot_stock_id": type("Loc", (), {"id": 40})(),
        })

        # Add 5 units in each of the 4 warehouses
        Quant.create({"id": 101, "product_id": laptop, "location_id": type("L", (), {"id": 10, "usage": "internal", "warehouse_id": wh1})(), "quantity": 5.0, "reserved_quantity": 0.0})
        Quant.create({"id": 102, "product_id": laptop, "location_id": type("L", (), {"id": 20, "usage": "internal", "warehouse_id": wh2})(), "quantity": 5.0, "reserved_quantity": 0.0})
        Quant.create({"id": 103, "product_id": laptop, "location_id": type("L", (), {"id": 30, "usage": "internal", "warehouse_id": wh3})(), "quantity": 5.0, "reserved_quantity": 0.0})
        Quant.create({"id": 104, "product_id": laptop, "location_id": type("L", (), {"id": 40, "usage": "internal", "warehouse_id": wh4})(), "quantity": 5.0, "reserved_quantity": 0.0})

        adapter = InventoryAdapter(env=mock_odoo_env)
        plan = adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=18.0,
        )

        assert len(plan.allocations) == 4
        assert [a.quantity for a in plan.allocations] == [5.0, 5.0, 5.0, 3.0]

        # Execute plan
        exec_res = adapter.apply_fulfillment_plan(sample_quotation.id, plan)
        assert exec_res["success"] is True
        assert len(exec_res["picking_ids"]) == 4
        assert exec_res["is_split"] is True

    def test_skewed_stock_skips_zero_stock_warehouses_standalone(self, standalone_empty_adapter: InventoryAdapter):
        """Tests skewed stock scenario: WH1 has 0, WH2 has 20. Request 10 units.
        
        Verifies:
        - WH1 is completely skipped (no 0-quantity entry).
        - 10 units cleanly allocated from WH2.
        - Result is direct fulfillment (single warehouse allocation).
        """
        standalone_empty_adapter.seed_inventory(
            product_id=77,
            warehouse_stocks={
                1: {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                2: {"qty_available": 20.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                3: {"qty_available": 0.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            },
        )
        standalone_empty_adapter.register_order(order_id=50, name="SO0050")

        plan = standalone_empty_adapter.calculate_fulfillment_split(
            order_id=50,
            product_id=77,
            requested_qty=10.0,
        )

        assert len(plan.allocations) == 1
        alloc = plan.allocations[0]
        assert alloc.warehouse_id == 2
        assert alloc.warehouse_name == "WH2 East"
        assert alloc.quantity == 10.0
        assert "Direct fulfillment from WH2 East (10.0 units)" in (plan.notes or "")

        # Execute and check picking
        res = standalone_empty_adapter.apply_fulfillment_plan(50, plan)
        assert res["success"] is True
        assert res["is_split"] is False
        assert len(res["picking_ids"]) == 1

        # Check warehouse stock: WH2 should now have 10 available, 10 reserved
        wh_stocks = standalone_empty_adapter.get_warehouse_stock(77)
        wh2_stock = next(w for w in wh_stocks if w["warehouse_id"] == 2)
        assert wh2_stock["qty_available"] == 10.0
        assert wh2_stock["qty_reserved"] == 10.0

    def test_multi_warehouse_routing_priority_by_sequence(self):
        """Verifies that warehouse allocation strictly respects sequence priority regardless of warehouse ID order."""
        # Non-linear sequence: WH3 has seq 1, WH1 has seq 2, WH2 has seq 3
        warehouses = [
            {"warehouse_id": 1, "warehouse_name": "WH1 Center", "sequence": 2},
            {"warehouse_id": 2, "warehouse_name": "WH2 Outskirts", "sequence": 3},
            {"warehouse_id": 3, "warehouse_name": "WH3 Priority Hub", "sequence": 1},
        ]
        adapter = InventoryAdapter(env=None, warehouse_data=warehouses)
        adapter.seed_inventory(
            product_id=10,
            warehouse_stocks={
                1: {"qty_available": 10.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                2: {"qty_available": 10.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
                3: {"qty_available": 10.0, "qty_reserved": 0.0, "qty_incoming": 0.0},
            },
        )
        adapter.register_order(order_id=60, name="SO0060")

        # Request 15 units: Should allocate 10 from WH3 (Priority 1) and 5 from WH1 (Priority 2)
        plan = adapter.calculate_fulfillment_split(order_id=60, product_id=10, requested_qty=15.0)
        assert len(plan.allocations) == 2
        assert plan.allocations[0].warehouse_id == 3
        assert plan.allocations[0].warehouse_name == "WH3 Priority Hub"
        assert plan.allocations[0].quantity == 10.0

        assert plan.allocations[1].warehouse_id == 1
        assert plan.allocations[1].warehouse_name == "WH1 Center"
        assert plan.allocations[1].quantity == 5.0


# =============================================================================
# ATTACK VECTOR 3: ADVERSARIAL STATE VIOLATIONS
# =============================================================================

class TestAdversarialStateViolations:
    """Stress tests simulating malicious tampering, state races, and replay attacks."""

    def test_toctou_stock_depleted_before_execution_standalone(self, standalone_4wh_adapter: InventoryAdapter):
        """TOCTOU Race Attack: Stock is available at plan calculation time, but depleted before execution.
        
        Must raise InvalidStateError and prevent any partial picking creation or state mutation.
        """
        adapter = standalone_4wh_adapter
        # Calculate plan for 18 units across 4 warehouses (5, 5, 5, 3)
        plan = adapter.calculate_fulfillment_split(order_id=401, product_id=1, requested_qty=18.0)
        assert len(plan.allocations) == 4

        # Adversarial race: Another transaction depletes WH1 to 2 units before apply_fulfillment_plan executes!
        adapter.set_warehouse_stock(product_id=1, warehouse_id=1, qty_available=2.0)

        # Attempt to apply plan -> must raise InvalidStateError
        with pytest.raises(InvalidStateError) as exc_info:
            adapter.apply_fulfillment_plan(order_id=401, fulfillment_plan=plan)

        err = exc_info.value
        assert "Stock violation" in err.message
        assert err.details.get("warehouse_id") == 1
        assert err.details.get("qty_available") == 2.0
        assert err.details.get("required_qty") == 5.0

        # Verify atomicity: No pickings were created
        open_pickings = adapter.get_open_pickings(401)
        assert len(open_pickings) == 0

        # WH1 stock was NOT altered
        wh1_stock = adapter._stock_store[1][1]
        assert wh1_stock["qty_available"] == 2.0
        assert wh1_stock["qty_reserved"] == 0.0

    def test_toctou_stock_depleted_before_execution_env(self, inventory_adapter: InventoryAdapter, sample_quotation: Any, mock_odoo_env: Any):
        """TOCTOU Race Attack in Odoo environment mode: Quant stock is depleted prior to plan execution."""
        # Calculate plan for 15 units (9 from WH1, 6 from WH2)
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=15.0,
        )

        # Adversarial race: Deplete WH1 quant in Odoo DB before plan is executed
        Quant = mock_odoo_env["stock.quant"]
        wh1_quant = Quant.search([("product_id.id", "=", 1), ("location_id.warehouse_id.id", "=", 1)])[0]
        wh1_quant.quantity = 1.0  # Only 1 unit remains, plan requires 9!

        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        assert "Stock violation" in str(exc_info.value)
        assert "WH1 Main" in str(exc_info.value)

    def test_apply_plan_to_cancelled_order_standalone(self, standalone_4wh_adapter: InventoryAdapter):
        """Attacks cancelled order in standalone mode: must reject with InvalidStateError."""
        standalone_4wh_adapter.register_order(order_id=402, name="SO0402", state="cancel")
        plan = FulfillmentPlanDTO(
            order_id=402,
            allocations=[FulfillmentSplitItem(product_id=1, warehouse_id=1, warehouse_name="WH1 Main", quantity=3.0)],
        )

        with pytest.raises(InvalidStateError) as exc_info:
            standalone_4wh_adapter.apply_fulfillment_plan(402, plan)

        assert "cancelled" in str(exc_info.value)

    def test_apply_plan_to_already_delivered_order_standalone(self, standalone_4wh_adapter: InventoryAdapter):
        """Attacks completed/delivered order (state='done') in standalone mode: must reject with InvalidStateError."""
        standalone_4wh_adapter.register_order(order_id=403, name="SO0403", state="done")
        plan = FulfillmentPlanDTO(
            order_id=403,
            allocations=[FulfillmentSplitItem(product_id=1, warehouse_id=1, warehouse_name="WH1 Main", quantity=3.0)],
        )

        with pytest.raises(InvalidStateError) as exc_info:
            standalone_4wh_adapter.apply_fulfillment_plan(403, plan)

        assert "delivered" in str(exc_info.value) or "done" in str(exc_info.value)

    def test_apply_plan_to_already_delivered_order_env(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Attacks completed/delivered order in Odoo ORM environment: must reject with InvalidStateError."""
        sample_quotation.state = "done"  # Order has already been delivered / closed
        plan = FulfillmentPlanDTO(
            order_id=sample_quotation.id,
            allocations=[FulfillmentSplitItem(product_id=1, warehouse_id=1, warehouse_name="WH1 Main", quantity=5.0)],
        )

        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        assert "delivered" in str(exc_info.value) or "done" in str(exc_info.value)

    def test_tampered_plan_quantities_over_and_under_allocation(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Tampering Attack: Modifying allocation quantities so the sum != requested quantity.
        
        Must be strictly intercepted and rejected with ValidationError.
        """
        # Step 1: Generate valid plan for 15 units
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=15.0,
        )
        assert plan.requested_qty == 15.0

        # Step 2: Attacker maliciously inflates allocation to 25 units
        plan.allocations[0].quantity = 19.0  # 19 + 6 = 25 units!
        with pytest.raises(ValidationError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        err = exc_info.value
        assert "Tampered fulfillment plan" in err.message
        assert err.details.get("requested_qty") == 15.0
        assert err.details.get("total_plan_qty") == 25.0

        # Step 3: Attacker maliciously reduces allocation to 7 units
        plan.allocations[0].quantity = 1.0  # 1 + 6 = 7 units!
        with pytest.raises(ValidationError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        assert "Tampered fulfillment plan" in exc_info.value.message

    def test_tampered_plan_negative_or_zero_quantity_allocation(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Tampering Attack: Inserting negative or zero quantity items into plan allocations."""
        plan_zero = FulfillmentPlanDTO(
            order_id=sample_quotation.id,
            allocations=[FulfillmentSplitItem(product_id=1, warehouse_id=1, warehouse_name="WH1 Main", quantity=0.0)],
        )
        with pytest.raises(ValidationError):
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan_zero)

        plan_negative = FulfillmentPlanDTO(
            order_id=sample_quotation.id,
            allocations=[
                FulfillmentSplitItem(product_id=1, warehouse_id=1, warehouse_name="WH1 Main", quantity=-5.0),
                FulfillmentSplitItem(product_id=1, warehouse_id=2, warehouse_name="WH2 East", quantity=10.0),
            ],
        )
        with pytest.raises(ValidationError):
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan_negative)

    def test_duplicate_batch_id_execution_rejected_duplicate_protection(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Replay Attack: Re-submitting the exact same fulfillment batch ID.
        
        Duplicate execution MUST be caught and rejected with InvalidStateError to prevent double-shipping.
        """
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=5.0,
        )
        batch_id = "BATCH-REPLAY-ATTACK-001"

        # Execution 1: Should succeed cleanly
        res1 = inventory_adapter.apply_fulfillment_plan(
            order_id=sample_quotation.id,
            fulfillment_plan=plan,
            batch_id=batch_id,
        )
        assert res1["success"] is True
        assert res1["dealflow_fulfillment_batch_id"] == batch_id

        # Execution 2: Re-submitting with identical batch_id without idempotent flag -> MUST FAIL
        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(
                order_id=sample_quotation.id,
                fulfillment_plan=plan,
                batch_id=batch_id,
            )

        err = exc_info.value
        assert "Duplicate fulfillment plan execution" in err.message
        assert err.details.get("batch_id") == batch_id

    def test_duplicate_batch_id_idempotent_execution(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Idempotency Verification: Submitting duplicate batch with idempotent=True safely returns existing pickings.
        
        Verifies no duplicate pickings are created and stock is not double-deducted.
        """
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=5.0,
        )
        batch_id = "BATCH-IDEMPOTENT-001"

        # First run
        res1 = inventory_adapter.apply_fulfillment_plan(
            order_id=sample_quotation.id,
            fulfillment_plan=plan,
            batch_id=batch_id,
        )
        initial_picking_ids = res1["picking_ids"]
        assert len(initial_picking_ids) == 1

        # Second run with idempotent=True
        res2 = inventory_adapter.apply_fulfillment_plan(
            order_id=sample_quotation.id,
            fulfillment_plan=plan,
            batch_id=batch_id,
            idempotent=True,
        )
        assert res2["success"] is True
        assert res2["status"] == "already_applied"
        assert res2["duplicate_prevented"] is True
        assert res2["picking_ids"] == initial_picking_ids

        # Verify no extra pickings in the system
        open_pickings = inventory_adapter.get_open_pickings(sample_quotation.id)
        assert len(open_pickings) == 1

    def test_reapplying_same_plan_instance_triggers_duplicate_protection(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Verifies that calling apply_fulfillment_plan twice with the SAME plan instance (without explicit batch ID)
        is protected because the plan instance recorded the generated batch_id.
        """
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=5.0,
        )
        # First execution generates a unique batch_id and assigns it to plan.batch_id
        res1 = inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)
        assert plan.batch_id == res1["dealflow_fulfillment_batch_id"]

        # Re-applying the exact same plan without idempotent=True must raise InvalidStateError
        with pytest.raises(InvalidStateError) as exc_info:
            inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)

        assert "Duplicate fulfillment plan execution" in exc_info.value.message


# =============================================================================
# ATTACK VECTOR 4: DATA INTEGRITY & MODEL METADATA
# =============================================================================

class TestDataIntegrityAndModelMetadata:
    """Stress tests verifying picking assignment, locations, and StockPicking model extensions."""

    def test_picking_assignment_data_integrity_standalone(self, standalone_4wh_adapter: InventoryAdapter):
        """Verifies picking record fields in standalone mode: warehouse IDs, locations, origin, batch ID."""
        plan = standalone_4wh_adapter.calculate_fulfillment_split(
            order_id=401,
            product_id=1,
            requested_qty=18.0,
        )
        res = standalone_4wh_adapter.apply_fulfillment_plan(401, plan)
        batch_id = res["dealflow_fulfillment_batch_id"]

        open_pickings = standalone_4wh_adapter.get_open_pickings(401)
        assert len(open_pickings) == 4

        expected_wh_ids = {1, 2, 3, 4}
        actual_wh_ids = {p["warehouse_id"] for p in open_pickings}
        assert actual_wh_ids == expected_wh_ids

        for p in open_pickings:
            assert p["order_id"] == 401
            assert p["dealflow_fulfillment_batch_id"] == batch_id
            assert p["dealflow_warehouse_split"] is True
            assert p["state"] == "assigned"
            assert "location_id" in p
            assert "location_dest_id" in p

            # Verify split details JSON
            split_details = json.loads(p["dealflow_split_details"])
            assert isinstance(split_details, list)
            assert len(split_details) == 4

    def test_picking_assignment_data_integrity_env(self, inventory_adapter: InventoryAdapter, sample_quotation: Any):
        """Verifies stock.picking records created in Odoo ORM environment mode."""
        plan = inventory_adapter.calculate_fulfillment_split(
            order_id=sample_quotation.id,
            product_id=1,
            requested_qty=15.0,
        )
        res = inventory_adapter.apply_fulfillment_plan(sample_quotation.id, plan)
        batch_id = res["dealflow_fulfillment_batch_id"]

        open_pickings = inventory_adapter.get_open_pickings(sample_quotation.id)
        assert len(open_pickings) == 2

        for p in open_pickings:
            assert p["dealflow_fulfillment_batch_id"] == batch_id
            assert p["dealflow_warehouse_split"] is True
            assert p["state"] == "assigned"
            assert p["warehouse_id"] in (1, 2)
            assert p["warehouse_name"] in ("WH1 Main", "WH2 East")

            # Parse split details from picking
            details = json.loads(p["dealflow_split_details"])
            assert len(details) == 2
            assert details[0]["warehouse_name"] == "WH1 Main"
            assert details[0]["quantity"] == 9.0
            assert details[1]["warehouse_name"] == "WH2 East"
            assert details[1]["quantity"] == 6.0

    def test_stock_picking_model_get_split_details_dict(self):
        """Tests StockPicking.get_split_details_dict method with valid, empty, and corrupted payloads."""
        picking = StockPicking()

        # Case 1: Valid JSON list
        alloc_data = [
            {"warehouse_id": 1, "warehouse_name": "WH1", "product_id": 1, "quantity": 9.0},
            {"warehouse_id": 2, "warehouse_name": "WH2", "product_id": 1, "quantity": 6.0},
        ]
        picking.dealflow_split_details = json.dumps(alloc_data)
        parsed = picking.get_split_details_dict()
        assert parsed == alloc_data

        # Case 2: Valid JSON dict
        dict_data = {"split_count": 2, "batch": "BATCH-01"}
        picking.dealflow_split_details = json.dumps(dict_data)
        assert picking.get_split_details_dict() == dict_data

        # Case 3: Empty string or None
        picking.dealflow_split_details = ""
        assert picking.get_split_details_dict() is None

        picking.dealflow_split_details = None
        assert picking.get_split_details_dict() is None

        # Case 4: Malformed / corrupted JSON -> returns None without raising exception
        picking.dealflow_split_details = "{corrupted_json: [1, 2,"
        assert picking.get_split_details_dict() is None

    def test_stock_picking_model_action_view_batch_pickings(self):
        """Tests StockPicking.action_view_batch_pickings method."""
        picking = StockPicking()

        # Case 1: No batch ID -> returns False
        picking.dealflow_fulfillment_batch_id = None
        assert picking.action_view_batch_pickings() is False

        # Case 2: Valid batch ID -> returns window action dict
        batch_id = "BATCH-TEST-VIEW-001"
        picking.dealflow_fulfillment_batch_id = batch_id
        action = picking.action_view_batch_pickings()
        assert isinstance(action, dict)
        assert action["type"] == "ir.actions.act_window"
        assert action["res_model"] == "stock.picking"
        assert action["domain"] == [("dealflow_fulfillment_batch_id", "=", batch_id)]
        assert batch_id in action["name"]
