# -*- coding: utf-8 -*-
"""
Recommendation Repository
Author: Person 1 (DB Architect)
Purpose: Handles deal-level recommendations (upsell, cross-sell, margin boosts) displayed in Rep Workspace.
"""

from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
from db.contracts import RecommendationDTO
from db.connection import get_db_cursor


class RecommendationRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def save_recommendations(self, deal_id: str, recommendations: List[RecommendationDTO]) -> List[str]:
        """Saves a batch of generated recommendations for a deal."""
        saved_ids = []
        with get_db_cursor(commit=True) as cur:
            for rec in recommendations:
                rec_id = rec.id or str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO recommendation
                           (id, deal_id, odoo_product_id, recommendation_type,
                            score, margin_delta, reason, source, status)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (rec_id, deal_id, rec.odoo_product_id, rec.recommendation_type,
                     rec.score, rec.margin_delta, rec.reason, rec.source, rec.status)
                )
                saved_ids.append(rec_id)
        return saved_ids

    def get_active_recommendations(self, deal_id: str) -> List[RecommendationDTO]:
        """Fetch active recommendations for a given deal/quote workspace."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, odoo_product_id, recommendation_type,
                          score, margin_delta, reason, source, status, created_at, dismissed_at
                   FROM recommendation
                   WHERE deal_id = %s AND status = 'ACTIVE'
                   ORDER BY score DESC, margin_delta DESC""",
                (deal_id,)
            )
            rows = cur.fetchall()
            return [
                RecommendationDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    odoo_product_id=row['odoo_product_id'],
                    recommendation_type=row['recommendation_type'],
                    score=float(row['score']),
                    margin_delta=float(row['margin_delta']),
                    reason=row['reason'],
                    source=row['source'],
                    status=row['status'],
                    created_at=row['created_at'],
                    dismissed_at=row['dismissed_at']
                )
                for row in rows
            ]

    def update_status(self, recommendation_id: str, new_status: str) -> bool:
        """Mark recommendation as ACCEPTED or DISMISSED."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE recommendation
                   SET status = %s,
                       dismissed_at = CASE WHEN %s = 'DISMISSED' THEN CURRENT_TIMESTAMP ELSE dismissed_at END
                   WHERE id = %s""",
                (new_status, new_status, recommendation_id)
            )
            return cur.rowcount > 0
