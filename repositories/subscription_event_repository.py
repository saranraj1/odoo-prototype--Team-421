# -*- coding: utf-8 -*-
"""
Subscription Event Repository
Author: Person 1 (DB Architect)
Purpose: Tracks mid-cycle subscription changes, proration calculations, and credit note issuance.
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import SubscriptionEventDTO
from db.connection import get_db_cursor


class SubscriptionEventRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def record_event(self, event: SubscriptionEventDTO) -> str:
        """Record a subscription lifecycle event (plan change, cancellation, proration, etc.)."""
        event_id = event.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO subscription_event
                       (id, deal_id, odoo_subscription_id, event_type,
                        old_plan, new_plan, old_quantity, new_quantity,
                        billing_cycle, proration_days_remaining, proration_total_days,
                        prorated_amount, credit_note_amount, odoo_credit_note_id, reason)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (event_id, event.deal_id, event.odoo_subscription_id, event.event_type,
                 event.old_plan, event.new_plan, event.old_quantity, event.new_quantity,
                 event.billing_cycle, event.proration_days_remaining, event.proration_total_days,
                 event.prorated_amount, event.credit_note_amount,
                 event.odoo_credit_note_id, event.reason)
            )
        return event_id

    def get_events_for_deal(self, deal_id: str) -> List[SubscriptionEventDTO]:
        """Fetch all subscription events for a deal, ordered chronologically."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, odoo_subscription_id, event_type,
                          old_plan, new_plan, old_quantity, new_quantity,
                          billing_cycle, proration_days_remaining, proration_total_days,
                          prorated_amount, credit_note_amount, odoo_credit_note_id,
                          reason, created_at
                   FROM subscription_event
                   WHERE deal_id = %s
                   ORDER BY created_at DESC""",
                (deal_id,)
            )
            rows = cur.fetchall()
            return [
                SubscriptionEventDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    odoo_subscription_id=row['odoo_subscription_id'],
                    event_type=row['event_type'],
                    old_plan=row['old_plan'],
                    new_plan=row['new_plan'],
                    old_quantity=row['old_quantity'],
                    new_quantity=row['new_quantity'],
                    billing_cycle=row['billing_cycle'],
                    proration_days_remaining=row['proration_days_remaining'],
                    proration_total_days=row['proration_total_days'],
                    prorated_amount=float(row['prorated_amount']) if row['prorated_amount'] else None,
                    credit_note_amount=float(row['credit_note_amount']) if row['credit_note_amount'] else 0.0,
                    odoo_credit_note_id=row['odoo_credit_note_id'],
                    reason=row['reason'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def get_events_by_subscription(self, odoo_subscription_id: int) -> List[SubscriptionEventDTO]:
        """Fetch all events for a specific Odoo subscription across deals."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, odoo_subscription_id, event_type,
                          old_plan, new_plan, old_quantity, new_quantity,
                          billing_cycle, proration_days_remaining, proration_total_days,
                          prorated_amount, credit_note_amount, odoo_credit_note_id,
                          reason, created_at
                   FROM subscription_event
                   WHERE odoo_subscription_id = %s
                   ORDER BY created_at DESC""",
                (odoo_subscription_id,)
            )
            rows = cur.fetchall()
            return [
                SubscriptionEventDTO(
                    id=str(row['id']),
                    deal_id=str(row['deal_id']),
                    odoo_subscription_id=row['odoo_subscription_id'],
                    event_type=row['event_type'],
                    old_plan=row['old_plan'],
                    new_plan=row['new_plan'],
                    old_quantity=row['old_quantity'],
                    new_quantity=row['new_quantity'],
                    billing_cycle=row['billing_cycle'],
                    proration_days_remaining=row['proration_days_remaining'],
                    proration_total_days=row['proration_total_days'],
                    prorated_amount=float(row['prorated_amount']) if row['prorated_amount'] else None,
                    credit_note_amount=float(row['credit_note_amount']) if row['credit_note_amount'] else 0.0,
                    odoo_credit_note_id=row['odoo_credit_note_id'],
                    reason=row['reason'],
                    created_at=row['created_at']
                )
                for row in rows
            ]

    def get_total_credits_for_deal(self, deal_id: str) -> float:
        """Sum total credit note amounts issued for a deal's subscription events."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT COALESCE(SUM(credit_note_amount), 0.00) AS total
                   FROM subscription_event
                   WHERE deal_id = %s AND credit_note_amount > 0""",
                (deal_id,)
            )
            row = cur.fetchone()
            return float(row['total']) if row else 0.0
