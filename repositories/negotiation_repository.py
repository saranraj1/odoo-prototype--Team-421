# -*- coding: utf-8 -*-
"""
Negotiation Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
from db.contracts import NegotiationRequestDTO, NegotiationChangeDTO
from db.connection import get_db_cursor


class NegotiationRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def stage_counter_offer(self, deal_id: str, odoo_sale_order_id: int,
                            customer_partner_id: int, message: str,
                            changes: List[Dict[str, Any]]) -> NegotiationRequestDTO:
        """
        Stages customer portal counter-offers in negotiation tables.
        Guarantees that Odoo sale order lines are NEVER mutated directly by external portal users.
        """
        req_id = str(uuid.uuid4())
        staged_changes = []
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO negotiation_request
                       (id, deal_id, odoo_sale_order_id, customer_partner_id,
                        requested_by, status, message)
                   VALUES (%s, %s, %s, %s, 'CUSTOMER', 'PENDING', %s)
                   RETURNING created_at""",
                (req_id, deal_id, odoo_sale_order_id, customer_partner_id, message)
            )
            req_row = cur.fetchone()

            for chg in changes:
                chg_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO negotiation_change
                           (id, negotiation_request_id, odoo_sale_order_line_id,
                            field_name, old_value, requested_value)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (chg_id, req_id, chg['odoo_line_id'],
                     chg.get('field_name', 'discount'),
                     str(chg['old_value']), str(chg['requested_value']))
                )
                staged_changes.append(NegotiationChangeDTO(
                    id=chg_id,
                    negotiation_request_id=req_id,
                    odoo_sale_order_line_id=chg['odoo_line_id'],
                    field_name=chg.get('field_name', 'discount'),
                    old_value=str(chg['old_value']),
                    requested_value=str(chg['requested_value'])
                ))

        return NegotiationRequestDTO(
            id=req_id,
            deal_id=deal_id,
            odoo_sale_order_id=odoo_sale_order_id,
            customer_partner_id=customer_partner_id,
            message=message,
            status="PENDING",
            changes=staged_changes,
            created_at=req_row['created_at'] if req_row else datetime.utcnow()
        )

    def mark_processed(self, negotiation_request_id: str, final_status: str) -> bool:
        """Updates status to ACCEPTED, REJECTED, or COUNTERED once reviewed."""
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """UPDATE negotiation_request
                   SET status = %s, processed_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (final_status, negotiation_request_id)
            )
            return cur.rowcount > 0

    def get_pending_for_deal(self, deal_id: str) -> List[NegotiationRequestDTO]:
        """Fetch all pending negotiation requests for a deal."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, odoo_sale_order_id, customer_partner_id,
                          requested_by, status, message, created_at, processed_at
                   FROM negotiation_request
                   WHERE deal_id = %s AND status = 'PENDING'
                   ORDER BY created_at DESC""",
                (deal_id,)
            )
            req_rows = cur.fetchall()
            results = []
            for row in req_rows:
                req_id = str(row['id'])
                cur.execute(
                    """SELECT id, negotiation_request_id, odoo_sale_order_line_id,
                              field_name, old_value, requested_value
                       FROM negotiation_change
                       WHERE negotiation_request_id = %s""",
                    (req_id,)
                )
                chg_rows = cur.fetchall()
                changes = [
                    NegotiationChangeDTO(
                        id=str(c['id']),
                        negotiation_request_id=str(c['negotiation_request_id']),
                        odoo_sale_order_line_id=c['odoo_sale_order_line_id'],
                        field_name=c['field_name'],
                        old_value=c['old_value'],
                        requested_value=c['requested_value']
                    )
                    for c in chg_rows
                ]
                results.append(NegotiationRequestDTO(
                    id=req_id,
                    deal_id=str(row['deal_id']),
                    odoo_sale_order_id=row['odoo_sale_order_id'],
                    customer_partner_id=row['customer_partner_id'],
                    requested_by=row['requested_by'],
                    status=row['status'],
                    message=row['message'],
                    changes=changes,
                    created_at=row['created_at'],
                    processed_at=row['processed_at']
                ))
            return results
