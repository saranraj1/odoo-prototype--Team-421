# -*- coding: utf-8 -*-
"""
Discount Policy Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
from db.contracts import DiscountPolicyDTO
from db.connection import get_db_cursor


class PolicyRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def get_effective_policy(self, customer_tier: str, category_id: Optional[int] = None, company_id: int = 1) -> Optional[DiscountPolicyDTO]:
        """
        Resolves effective discount policy.
        Resolution precedence: Category-specific policy -> Customer tier default -> Global ('ALL') policy.
        Uses priority column — lower number = higher precedence.
        """
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, name, customer_tier, product_category_id,
                          max_discount_pct, manager_threshold, finance_threshold,
                          minimum_margin_pct, priority, active,
                          effective_from, effective_to
                   FROM discount_policy
                   WHERE active = TRUE
                     AND company_id = %s
                     AND customer_tier IN (%s, 'ALL')
                     AND (product_category_id = %s OR product_category_id IS NULL)
                     AND effective_from <= CURRENT_DATE
                     AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                   ORDER BY
                     CASE WHEN product_category_id = %s THEN 0 ELSE 1 END,
                     CASE WHEN customer_tier = %s THEN 0 ELSE 1 END,
                     priority ASC
                   LIMIT 1""",
                (company_id, customer_tier, category_id, category_id, customer_tier)
            )
            row = cur.fetchone()
            if not row:
                return None
            return DiscountPolicyDTO(
                id=str(row['id']),
                name=row['name'],
                customer_tier=row['customer_tier'],
                product_category_id=row['product_category_id'],
                max_discount_pct=float(row['max_discount_pct']),
                manager_threshold=float(row['manager_threshold']),
                finance_threshold=float(row['finance_threshold']),
                minimum_margin_pct=float(row['minimum_margin_pct']),
                priority=row['priority'],
                active=row['active'],
                effective_from=str(row['effective_from']) if row['effective_from'] else None,
                effective_to=str(row['effective_to']) if row['effective_to'] else None
            )

    def list_all_active_policies(self, company_id: int = 1) -> List[DiscountPolicyDTO]:
        """List all active policies for administration."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, name, customer_tier, product_category_id,
                          max_discount_pct, manager_threshold, finance_threshold,
                          minimum_margin_pct, priority, active,
                          effective_from, effective_to
                   FROM discount_policy
                   WHERE active = TRUE AND company_id = %s
                   ORDER BY priority ASC, customer_tier ASC""",
                (company_id,)
            )
            rows = cur.fetchall()
            return [
                DiscountPolicyDTO(
                    id=str(row['id']),
                    name=row['name'],
                    customer_tier=row['customer_tier'],
                    product_category_id=row['product_category_id'],
                    max_discount_pct=float(row['max_discount_pct']),
                    manager_threshold=float(row['manager_threshold']),
                    finance_threshold=float(row['finance_threshold']),
                    minimum_margin_pct=float(row['minimum_margin_pct']),
                    priority=row['priority'],
                    active=row['active'],
                    effective_from=str(row['effective_from']) if row['effective_from'] else None,
                    effective_to=str(row['effective_to']) if row['effective_to'] else None
                )
                for row in rows
            ]

    def create_policy(self, policy: DiscountPolicyDTO) -> str:
        """Create a new discount policy."""
        import uuid
        policy_id = policy.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO discount_policy
                       (id, name, customer_tier, product_category_id,
                        max_discount_pct, manager_threshold, finance_threshold,
                        minimum_margin_pct, priority, active, effective_from, effective_to)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (policy_id, policy.name, policy.customer_tier, policy.product_category_id,
                 policy.max_discount_pct, policy.manager_threshold, policy.finance_threshold,
                 policy.minimum_margin_pct, policy.priority, policy.active,
                 policy.effective_from, policy.effective_to)
            )
        return policy_id
