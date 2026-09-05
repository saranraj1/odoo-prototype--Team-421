# -*- coding: utf-8 -*-
"""
Approval Workflow Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
from db.contracts import ApprovalRequestDTO, ApprovalActionDTO
from db.connection import get_db_cursor


class ApprovalRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def create_chain(self, deal_id: str, risk_assessment_id: str, levels: List[str]) -> List[ApprovalRequestDTO]:
        """Creates sequential approval requests (e.g. ['SALES_MANAGER', 'FINANCE'])."""
        requests = []
        with get_db_cursor(commit=True) as cur:
            for seq, level in enumerate(levels, start=1):
                req_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO approval_request
                           (id, deal_id, risk_assessment_id, required_level, sequence, status)
                       VALUES (%s, %s, %s, %s, %s, 'PENDING')
                       RETURNING requested_at""",
                    (req_id, deal_id, risk_assessment_id, level, seq)
                )
                row = cur.fetchone()
                requests.append(ApprovalRequestDTO(
                    id=req_id,
                    deal_id=deal_id,
                    risk_assessment_id=risk_assessment_id,
                    required_level=level,
                    sequence=seq,
                    status="PENDING",
                    requested_at=row['requested_at'] if row else datetime.utcnow()
                ))
        return requests

    def record_action(self, request_id: str, actor_user_id: int, action: str, reason: Optional[str] = None) -> ApprovalActionDTO:
        """
        Records an approval action (APPROVED, REJECTED, RETURNED).
        Never overwrites previous actions.
        """
        action_id = str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            # Insert the action record
            cur.execute(
                """INSERT INTO approval_action
                       (id, approval_request_id, actor_user_id, action, reason)
                   VALUES (%s, %s, %s, %s, %s)
                   RETURNING created_at""",
                (action_id, request_id, actor_user_id, action, reason)
            )
            action_row = cur.fetchone()

            # Update the approval request status
            new_status = action  # APPROVED, REJECTED, RETURNED map directly
            cur.execute(
                """UPDATE approval_request
                   SET status = %s, completed_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (new_status, request_id)
            )

        return ApprovalActionDTO(
            id=action_id,
            approval_request_id=request_id,
            actor_user_id=actor_user_id,
            action=action,
            reason=reason,
            created_at=action_row['created_at'] if action_row else datetime.utcnow()
        )

    def invalidate_pending_approvals(self, deal_id: str, reason: str) -> int:
        """
        Marks any active pending approval requests as INVALIDATED when material changes occur.
        Returns count of invalidated requests.
        """
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE approval_request
                   SET status = 'INVALIDATED', completed_at = CURRENT_TIMESTAMP
                   WHERE deal_id = %s AND status = 'PENDING'""",
                (deal_id,)
            )
            return cur.rowcount

    def list_pending_by_level(self, level: str) -> List[ApprovalRequestDTO]:
        """Lists active approvals for manager or finance queues."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT ar.id, ar.deal_id, ar.risk_assessment_id, ar.required_level,
                          ar.sequence, ar.status, ar.requested_at, ar.completed_at
                   FROM approval_request ar
                   WHERE ar.required_level = %s AND ar.status = 'PENDING'
                   ORDER BY ar.requested_at ASC""",
                (level,)
            )
            rows = cur.fetchall()
            return [
                ApprovalRequestDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    risk_assessment_id=str(row['risk_assessment_id']),
                    required_level=row['required_level'],
                    sequence=row['sequence'],
                    status=row['status'],
                    requested_at=row['requested_at'],
                    completed_at=row['completed_at']
                )
                for row in rows
            ]

    def get_chain_for_deal(self, deal_id: str) -> List[ApprovalRequestDTO]:
        """Get the full approval chain for a deal including actions."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, risk_assessment_id, required_level,
                          sequence, status, requested_at, completed_at
                   FROM approval_request
                   WHERE deal_id = %s
                   ORDER BY sequence ASC""",
                (deal_id,)
            )
            request_rows = cur.fetchall()
            results = []
            for row in request_rows:
                req_id = str(row['id'])
                cur.execute(
                    """SELECT id, approval_request_id, actor_user_id, action, reason, created_at
                       FROM approval_action
                       WHERE approval_request_id = %s
                       ORDER BY created_at ASC""",
                    (req_id,)
                )
                action_rows = cur.fetchall()
                actions = [
                    ApprovalActionDTO(
                        id=str(a['id']),
                        approval_request_id=str(a['approval_request_id']),
                        actor_user_id=a['actor_user_id'],
                        action=a['action'],
                        reason=a['reason'],
                        created_at=a['created_at']
                    )
                    for a in action_rows
                ]
                results.append(ApprovalRequestDTO(
                    id=req_id,
                    deal_id=str(row['deal_id']),
                    risk_assessment_id=str(row['risk_assessment_id']),
                    required_level=row['required_level'],
                    sequence=row['sequence'],
                    status=row['status'],
                    requested_at=row['requested_at'],
                    completed_at=row['completed_at'],
                    actions=actions
                ))
            return results
