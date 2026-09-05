# -*- coding: utf-8 -*-
"""
Audit Event Repository
Author: Person 1 (DB Architect)
Purpose: System Memory — Immutable append-only audit trail for all governance events.
"""

from typing import Optional, List, Dict, Any
import uuid
import json
from datetime import datetime
from db.contracts import AuditEventDTO
from db.connection import get_db_cursor


class AuditRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def log_event(self, deal_id: str, event_type: str, entity_type: str,
                  entity_id: str, actor_type: str = "SYSTEM", actor_id: int = 0,
                  before_state: Optional[Dict[str, Any]] = None,
                  after_state: Optional[Dict[str, Any]] = None,
                  reason: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> AuditEventDTO:
        """
        Appends an immutable audit record to the system event log.
        Guarantees Invariant 5: Every material decision creates an audit event.
        """
        event_id = str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO audit_event
                       (id, deal_id, event_type, actor_type, actor_id,
                        entity_type, entity_id, before_state, after_state,
                        reason, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING created_at""",
                (event_id, deal_id, event_type, actor_type, actor_id,
                 entity_type, entity_id,
                 json.dumps(before_state) if before_state else None,
                 json.dumps(after_state) if after_state else None,
                 reason,
                 json.dumps(metadata) if metadata else None)
            )
            row = cur.fetchone()

        return AuditEventDTO(
            id=event_id,
            deal_id=deal_id,
            event_type=event_type,
            actor_type=actor_type,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            metadata=metadata,
            created_at=row['created_at'] if row else datetime.utcnow()
        )

    def get_deal_timeline(self, deal_id: str) -> List[AuditEventDTO]:
        """Fetches chronological audit history for a specific deal."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, event_type, actor_type, actor_id,
                          entity_type, entity_id, before_state, after_state,
                          reason, metadata, created_at
                   FROM audit_event
                   WHERE deal_id = %s
                   ORDER BY created_at ASC""",
                (deal_id,)
            )
            rows = cur.fetchall()
            return [
                AuditEventDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    event_type=row['event_type'],
                    actor_type=row['actor_type'],
                    actor_id=row['actor_id'],
                    entity_type=row['entity_type'],
                    entity_id=str(row['entity_id']),
                    before_state=row['before_state'],
                    after_state=row['after_state'],
                    reason=row['reason'],
                    metadata=row['metadata'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def get_events_by_type(self, event_type: str, limit: int = 50) -> List[AuditEventDTO]:
        """Fetch events by type for system-wide audit reports."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, event_type, actor_type, actor_id,
                          entity_type, entity_id, before_state, after_state,
                          reason, metadata, created_at
                   FROM audit_event
                   WHERE event_type = %s
                   ORDER BY created_at DESC
                   LIMIT %s""",
                (event_type, limit)
            )
            rows = cur.fetchall()
            return [
                AuditEventDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    event_type=row['event_type'],
                    actor_type=row['actor_type'],
                    actor_id=row['actor_id'],
                    entity_type=row['entity_type'],
                    entity_id=str(row['entity_id']),
                    before_state=row['before_state'],
                    after_state=row['after_state'],
                    reason=row['reason'],
                    metadata=row['metadata'],
                    created_at=row['created_at']
                )
                for row in rows
            ]
