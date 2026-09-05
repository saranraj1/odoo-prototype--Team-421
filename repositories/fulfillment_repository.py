# -*- coding: utf-8 -*-
"""
Fulfillment Plan Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
from db.contracts import FulfillmentPlanDTO, FulfillmentPlanLineDTO
from db.connection import get_db_cursor


class FulfillmentRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def save_plan(self, plan: FulfillmentPlanDTO) -> str:
        """
        Saves a proposed or overridden fulfillment warehouse split plan.
        Preserves plan versions across deal modifications.
        Enforces Quantity Conservation Invariant: allocated_qty + backorder_qty = requested_qty.
        """
        # Application-level invariant check before hitting the DB
        for line in plan.lines:
            if round(line.allocated_qty + line.backorder_qty, 4) != round(line.requested_qty, 4):
                raise ValueError(
                    f"Invariant 1 Violated: allocated ({line.allocated_qty}) + "
                    f"backorder ({line.backorder_qty}) != requested ({line.requested_qty})"
                )

        plan_id = plan.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO fulfillment_plan
                       (id, deal_id, odoo_sale_order_id, status,
                        estimated_shipments, estimated_shipping_cost, algorithm_version)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (plan_id, plan.deal_id, plan.odoo_sale_order_id, plan.status,
                 plan.estimated_shipments, plan.estimated_shipping_cost,
                 plan.algorithm_version)
            )
            for line in plan.lines:
                line_id = line.id or str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO fulfillment_plan_line
                           (id, fulfillment_plan_id, odoo_product_id, odoo_warehouse_id,
                            requested_qty, allocated_qty, backorder_qty, shipping_cost)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (line_id, plan_id, line.odoo_product_id, line.odoo_warehouse_id,
                     line.requested_qty, line.allocated_qty,
                     line.backorder_qty, line.shipping_cost)
                )
        return plan_id

    def get_active_plan(self, deal_id: str) -> Optional[FulfillmentPlanDTO]:
        """Fetch current active fulfillment plan for a deal."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, odoo_sale_order_id, status,
                          estimated_shipments, estimated_shipping_cost,
                          algorithm_version, generated_at
                   FROM fulfillment_plan
                   WHERE deal_id = %s AND status IN ('PROPOSED', 'ACCEPTED')
                   ORDER BY generated_at DESC
                   LIMIT 1""",
                (deal_id,)
            )
            row = cur.fetchone()
            if not row:
                return None

            plan_id = str(row['id'])
            cur.execute(
                """SELECT id, fulfillment_plan_id, odoo_product_id, odoo_warehouse_id,
                          requested_qty, allocated_qty, backorder_qty, shipping_cost
                   FROM fulfillment_plan_line
                   WHERE fulfillment_plan_id = %s""",
                (plan_id,)
            )
            line_rows = cur.fetchall()
            lines = [
                FulfillmentPlanLineDTO(
                    id=str(l['id']),
                    fulfillment_plan_id=str(l['fulfillment_plan_id']),
                    odoo_product_id=l['odoo_product_id'],
                    odoo_warehouse_id=l['odoo_warehouse_id'],
                    requested_qty=float(l['requested_qty']),
                    allocated_qty=float(l['allocated_qty']),
                    backorder_qty=float(l['backorder_qty']),
                    shipping_cost=float(l['shipping_cost'])
                )
                for l in line_rows
            ]

            return FulfillmentPlanDTO(
                id=plan_id,
                deal_id=str(row['deal_id']),
                odoo_sale_order_id=row['odoo_sale_order_id'],
                status=row['status'],
                estimated_shipments=row['estimated_shipments'],
                estimated_shipping_cost=float(row['estimated_shipping_cost']),
                algorithm_version=row['algorithm_version'],
                lines=lines,
                generated_at=row['generated_at']
            )

    def update_plan_status(self, plan_id: str, new_status: str) -> bool:
        """Update plan status (e.g., PROPOSED -> ACCEPTED or OVERRIDDEN)."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE fulfillment_plan SET status = %s WHERE id = %s""",
                (new_status, plan_id)
            )
            return cur.rowcount > 0
