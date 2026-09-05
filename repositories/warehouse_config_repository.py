# -*- coding: utf-8 -*-
"""
Warehouse Configuration Repository
Author: Person 1 (DB Architect)
Purpose: Admin CRUD for warehouse shipping cost weights used by the auto-split optimizer.
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import WarehouseConfigDTO
from db.connection import get_db_cursor


class WarehouseConfigRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def create_config(self, config: WarehouseConfigDTO) -> str:
        """Create or update a warehouse configuration record."""
        config_id = config.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO warehouse_config
                       (id, odoo_warehouse_id, name, location,
                        shipping_cost_weight, is_primary, active, company_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (odoo_warehouse_id) DO UPDATE SET
                       name = EXCLUDED.name,
                       location = EXCLUDED.location,
                       shipping_cost_weight = EXCLUDED.shipping_cost_weight,
                       is_primary = EXCLUDED.is_primary,
                       active = EXCLUDED.active""",
                (config_id, config.odoo_warehouse_id, config.name, config.location,
                 config.shipping_cost_weight, config.is_primary,
                 config.active, config.company_id)
            )
        return config_id

    def get_by_odoo_id(self, odoo_warehouse_id: int) -> Optional[WarehouseConfigDTO]:
        """Fetch warehouse config by Odoo warehouse ID."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_warehouse_id, name, location,
                          shipping_cost_weight, is_primary, active,
                          company_id, created_at
                   FROM warehouse_config
                   WHERE odoo_warehouse_id = %s""",
                (odoo_warehouse_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return WarehouseConfigDTO(
                id=str(row['id']),
                odoo_warehouse_id=row['odoo_warehouse_id'],
                name=row['name'],
                location=row['location'],
                shipping_cost_weight=float(row['shipping_cost_weight']),
                is_primary=row['is_primary'],
                active=row['active'],
                company_id=row['company_id'],
                created_at=row['created_at']
            )

    def list_active(self, company_id: int = 1) -> List[WarehouseConfigDTO]:
        """List all active warehouse configs for the split optimizer."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_warehouse_id, name, location,
                          shipping_cost_weight, is_primary, active,
                          company_id, created_at
                   FROM warehouse_config
                   WHERE active = TRUE AND company_id = %s
                   ORDER BY is_primary DESC, shipping_cost_weight ASC""",
                (company_id,)
            )
            rows = cur.fetchall()
            return [
                WarehouseConfigDTO(
                    id=str(row['id']),
                    odoo_warehouse_id=row['odoo_warehouse_id'],
                    name=row['name'],
                    location=row['location'],
                    shipping_cost_weight=float(row['shipping_cost_weight']),
                    is_primary=row['is_primary'],
                    active=row['active'],
                    company_id=row['company_id'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def deactivate(self, odoo_warehouse_id: int) -> bool:
        """Soft-delete a warehouse config by deactivating it."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE warehouse_config SET active = FALSE WHERE odoo_warehouse_id = %s""",
                (odoo_warehouse_id,)
            )
            return cur.rowcount > 0
