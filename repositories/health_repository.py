# -*- coding: utf-8 -*-
"""
Deal Health Snapshot Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
from db.contracts import DealHealthSnapshotDTO
from db.connection import get_db_cursor


class HealthRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def record_snapshot(self, snapshot: DealHealthSnapshotDTO) -> str:
        """Records a point-in-time deal health snapshot."""
        snapshot_id = snapshot.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO deal_health_snapshot
                       (id, deal_id, health_status, overall_score,
                        stalled_score, discount_anomaly_score,
                        delivery_risk_score, approval_delay_score)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (snapshot_id, snapshot.deal_id, snapshot.health_status,
                 snapshot.overall_score, snapshot.stalled_score,
                 snapshot.discount_anomaly_score, snapshot.delivery_risk_score,
                 snapshot.approval_delay_score)
            )
        return snapshot_id

    def get_latest_snapshot(self, deal_id: str) -> Optional[DealHealthSnapshotDTO]:
        """Fetch the most recent health metrics for a deal."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, health_status, overall_score,
                          stalled_score, discount_anomaly_score,
                          delivery_risk_score, approval_delay_score, calculated_at
                   FROM deal_health_snapshot
                   WHERE deal_id = %s
                   ORDER BY calculated_at DESC
                   LIMIT 1""",
                (deal_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return DealHealthSnapshotDTO(
                id=str(row['id']),
                deal_id=str(row['deal_id']),
                health_status=row['health_status'],
                overall_score=float(row['overall_score']),
                stalled_score=float(row['stalled_score']),
                discount_anomaly_score=float(row['discount_anomaly_score']),
                delivery_risk_score=float(row['delivery_risk_score']),
                approval_delay_score=float(row['approval_delay_score']),
                calculated_at=row['calculated_at']
            )

    def list_stalled_deals(self, days_threshold: int = 7) -> List[Dict[str, Any]]:
        """Queries deals where status has not progressed past threshold days."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT d.id AS deal_id, d.odoo_sale_order_id, d.status,
                          d.health_status, d.current_risk_score, d.updated_at,
                          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - d.updated_at)) / 86400 AS days_stalled
                   FROM deal d
                   WHERE d.status NOT IN ('CLOSED', 'BILLING')
                     AND d.updated_at < CURRENT_TIMESTAMP - INTERVAL '%s days'
                   ORDER BY d.updated_at ASC""",
                (days_threshold,)
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]

    def list_anomalies(self, min_anomaly_score: float = 30.0) -> List[DealHealthSnapshotDTO]:
        """Fetch latest health snapshots that have elevated discount anomaly scores."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT DISTINCT ON (deal_id)
                          id, deal_id, health_status, overall_score,
                          stalled_score, discount_anomaly_score,
                          delivery_risk_score, approval_delay_score, calculated_at
                   FROM deal_health_snapshot
                   WHERE discount_anomaly_score >= %s
                   ORDER BY deal_id, calculated_at DESC""",
                (min_anomaly_score,)
            )
            rows = cur.fetchall()
            return [
                DealHealthSnapshotDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    health_status=row['health_status'],
                    overall_score=float(row['overall_score']),
                    stalled_score=float(row['stalled_score']),
                    discount_anomaly_score=float(row['discount_anomaly_score']),
                    delivery_risk_score=float(row['delivery_risk_score']),
                    approval_delay_score=float(row['approval_delay_score']),
                    calculated_at=row['calculated_at']
                )
                for row in rows
            ]
