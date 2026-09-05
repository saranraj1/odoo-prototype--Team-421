# -*- coding: utf-8 -*-
"""
Deal Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import DealDTO
from db.connection import get_db_cursor


class DealRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def get_by_id(self, deal_id: str) -> Optional[DealDTO]:
        """Fetch deal record by UUID."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_sale_order_id, odoo_partner_id, owner_user_id,
                          company_id, status, approval_state, health_status,
                          current_risk_score, created_at, updated_at
                   FROM deal WHERE id = %s""",
                (deal_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return DealDTO(
                id=str(row['id']),
                odoo_sale_order_id=row['odoo_sale_order_id'],
                odoo_partner_id=row['odoo_partner_id'],
                owner_user_id=row['owner_user_id'],
                company_id=row['company_id'],
                status=row['status'],
                approval_state=row['approval_state'],
                health_status=row['health_status'],
                current_risk_score=float(row['current_risk_score']),
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )

    def get_by_odoo_order_id(self, odoo_sale_order_id: int) -> Optional[DealDTO]:
        """Fetch deal record mapped 1:1 with Odoo sale order."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_sale_order_id, odoo_partner_id, owner_user_id,
                          company_id, status, approval_state, health_status,
                          current_risk_score, created_at, updated_at
                   FROM deal WHERE odoo_sale_order_id = %s""",
                (odoo_sale_order_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return DealDTO(
                id=str(row['id']),
                odoo_sale_order_id=row['odoo_sale_order_id'],
                odoo_partner_id=row['odoo_partner_id'],
                owner_user_id=row['owner_user_id'],
                company_id=row['company_id'],
                status=row['status'],
                approval_state=row['approval_state'],
                health_status=row['health_status'],
                current_risk_score=float(row['current_risk_score']),
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )

    def create_deal(self, odoo_sale_order_id: int, odoo_partner_id: int,
                    owner_user_id: int, company_id: int = 1) -> DealDTO:
        """Create new deal record."""
        deal_id = str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO deal (id, odoo_sale_order_id, odoo_partner_id, owner_user_id,
                                     company_id, status, approval_state, health_status, current_risk_score)
                   VALUES (%s, %s, %s, %s, %s, 'DRAFT', 'NONE', 'HEALTHY', 0.00)
                   ON CONFLICT (odoo_sale_order_id) DO NOTHING
                   RETURNING id, created_at, updated_at""",
                (deal_id, odoo_sale_order_id, odoo_partner_id, owner_user_id, company_id)
            )
            row = cur.fetchone()
            created_at = row['created_at'] if row else None
            updated_at = row['updated_at'] if row else None

        return DealDTO(
            id=deal_id,
            odoo_sale_order_id=odoo_sale_order_id,
            odoo_partner_id=odoo_partner_id,
            owner_user_id=owner_user_id,
            company_id=company_id,
            status="DRAFT",
            approval_state="NONE",
            health_status="HEALTHY",
            current_risk_score=0.0,
            created_at=created_at,
            updated_at=updated_at
        )

    def update_status(self, deal_id: str, status: str, approval_state: str, risk_score: float) -> bool:
        """Update deal lifecycle status and risk score."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE deal
                   SET status = %s, approval_state = %s, current_risk_score = %s,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (status, approval_state, risk_score, deal_id)
            )
            return cur.rowcount > 0

    def update_health(self, deal_id: str, health_status: str) -> bool:
        """Update deal health status."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE deal
                   SET health_status = %s, updated_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (health_status, deal_id)
            )
            return cur.rowcount > 0

    def list_at_risk_deals(self, limit: int = 50) -> List[DealDTO]:
        """Fetch deals flagged as AT_RISK or CRITICAL for manager control tower."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_sale_order_id, odoo_partner_id, owner_user_id,
                          company_id, status, approval_state, health_status,
                          current_risk_score, created_at, updated_at
                   FROM deal
                   WHERE health_status IN ('AT_RISK', 'CRITICAL')
                   ORDER BY current_risk_score DESC
                   LIMIT %s""",
                (limit,)
            )
            rows = cur.fetchall()
            return [
                DealDTO(
                    id=str(row['id']),
                    odoo_sale_order_id=row['odoo_sale_order_id'],
                    odoo_partner_id=row['odoo_partner_id'],
                    owner_user_id=row['owner_user_id'],
                    company_id=row['company_id'],
                    status=row['status'],
                    approval_state=row['approval_state'],
                    health_status=row['health_status'],
                    current_risk_score=float(row['current_risk_score']),
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                )
                for row in rows
            ]

    def list_by_status(self, status: str, limit: int = 50) -> List[DealDTO]:
        """Fetch deals filtered by status for pipeline views."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, odoo_sale_order_id, odoo_partner_id, owner_user_id,
                          company_id, status, approval_state, health_status,
                          current_risk_score, created_at, updated_at
                   FROM deal
                   WHERE status = %s
                   ORDER BY updated_at DESC
                   LIMIT %s""",
                (status, limit)
            )
            rows = cur.fetchall()
            return [
                DealDTO(
                    id=str(row['id']),
                    odoo_sale_order_id=row['odoo_sale_order_id'],
                    odoo_partner_id=row['odoo_partner_id'],
                    owner_user_id=row['owner_user_id'],
                    company_id=row['company_id'],
                    status=row['status'],
                    approval_state=row['approval_state'],
                    health_status=row['health_status'],
                    current_risk_score=float(row['current_risk_score']),
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                )
                for row in rows
            ]
