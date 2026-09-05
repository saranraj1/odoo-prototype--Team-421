# -*- coding: utf-8 -*-
"""
Upsell Rule Configuration Repository
Author: Person 1 (DB Architect)
Purpose: Admin CRUD for product pairing rules that drive the upsell/cross-sell recommendation engine.
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import UpsellRuleDTO
from db.connection import get_db_cursor


class UpsellRuleRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def create_rule(self, rule: UpsellRuleDTO) -> str:
        """Create a new upsell/cross-sell pairing rule."""
        rule_id = rule.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO upsell_rule
                       (id, base_product_id, suggested_product_id,
                        min_margin_threshold, is_promoted, active, company_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (rule_id, rule.base_product_id, rule.suggested_product_id,
                 rule.min_margin_threshold, rule.is_promoted,
                 rule.active, rule.company_id)
            )
        return rule_id

    def get_suggestions_for_product(self, base_product_id: int, company_id: int = 1) -> List[UpsellRuleDTO]:
        """Fetch active upsell/cross-sell suggestions for a given base product."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, base_product_id, suggested_product_id,
                          min_margin_threshold, is_promoted, active,
                          company_id, created_at
                   FROM upsell_rule
                   WHERE base_product_id = %s
                     AND active = TRUE
                     AND company_id = %s
                   ORDER BY is_promoted DESC, min_margin_threshold ASC""",
                (base_product_id, company_id)
            )
            rows = cur.fetchall()
            return [
                UpsellRuleDTO(
                    id=str(row['id']),
                    base_product_id=row['base_product_id'],
                    suggested_product_id=row['suggested_product_id'],
                    min_margin_threshold=float(row['min_margin_threshold']),
                    is_promoted=row['is_promoted'],
                    active=row['active'],
                    company_id=row['company_id'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def get_all_for_cart(self, product_ids: List[int], company_id: int = 1) -> List[UpsellRuleDTO]:
        """Fetch all active suggestions for a list of products currently in the cart."""
        if not product_ids:
            return []
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, base_product_id, suggested_product_id,
                          min_margin_threshold, is_promoted, active,
                          company_id, created_at
                   FROM upsell_rule
                   WHERE base_product_id = ANY(%s)
                     AND suggested_product_id != ALL(%s)
                     AND active = TRUE
                     AND company_id = %s
                   ORDER BY is_promoted DESC, min_margin_threshold ASC""",
                (product_ids, product_ids, company_id)
            )
            rows = cur.fetchall()
            return [
                UpsellRuleDTO(
                    id=str(row['id']),
                    base_product_id=row['base_product_id'],
                    suggested_product_id=row['suggested_product_id'],
                    min_margin_threshold=float(row['min_margin_threshold']),
                    is_promoted=row['is_promoted'],
                    active=row['active'],
                    company_id=row['company_id'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def list_all_active(self, company_id: int = 1) -> List[UpsellRuleDTO]:
        """List all active upsell rules for admin configuration view."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, base_product_id, suggested_product_id,
                          min_margin_threshold, is_promoted, active,
                          company_id, created_at
                   FROM upsell_rule
                   WHERE active = TRUE AND company_id = %s
                   ORDER BY base_product_id ASC""",
                (company_id,)
            )
            rows = cur.fetchall()
            return [
                UpsellRuleDTO(
                    id=str(row['id']),
                    base_product_id=row['base_product_id'],
                    suggested_product_id=row['suggested_product_id'],
                    min_margin_threshold=float(row['min_margin_threshold']),
                    is_promoted=row['is_promoted'],
                    active=row['active'],
                    company_id=row['company_id'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def deactivate_rule(self, rule_id: str) -> bool:
        """Soft-delete an upsell rule by deactivating it."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE upsell_rule SET active = FALSE WHERE id = %s""",
                (rule_id,)
            )
            return cur.rowcount > 0
