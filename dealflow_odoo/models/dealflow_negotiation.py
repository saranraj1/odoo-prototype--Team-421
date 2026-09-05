# -*- coding: utf-8 -*-
"""DealFlow360 — Customer Negotiation Model.

This model encapsulates customer counter-proposals and terms negotiations on quotations.
Customer portal users interact with this model rather than editing sale.order directly,
ensuring strict data integrity, auditability, and governance isolation.
"""

from typing import Any, Dict, List, Optional
import logging

try:
    from odoo import api, fields, models, _
    from odoo.exceptions import AccessError, ValidationError, UserError
except ImportError:
    class _MockFields:
        class Datetime:
            def __init__(self, *args, **kwargs): pass
            @staticmethod
            def now(): return "2026-09-05 10:00:00"
            @staticmethod
            def to_string(val): return str(val) if val else None
        def Char(self, *args, **kwargs): return None
        def Float(self, *args, **kwargs): return None
        def Boolean(self, *args, **kwargs): return None
        def Selection(self, *args, **kwargs): return None
        def Date(self, *args, **kwargs): return None
        def Many2one(self, *args, **kwargs): return None
        def One2many(self, *args, **kwargs): return None
        def Text(self, *args, **kwargs): return None

    class _MockAPI:
        @staticmethod
        def depends(*args):
            def decorator(f): return f
            return decorator
        @staticmethod
        def onchange(*args):
            def decorator(f): return f
            return decorator
        @staticmethod
        def constrains(*args):
            def decorator(f): return f
            return decorator
        @staticmethod
        def model_create_multi(f):
            return f

    class _MockModels:
        class Model:
            _name = None
            _inherit = None
            _description = None
            _order = None
            _rec_name = None
            def create(self, vals_list): return []
            def write(self, vals): return True
            def browse(self, *args): return self
            def exists(self): return True
            def sudo(self): return self

    class AccessError(Exception): pass
    class UserError(Exception): pass
    class ValidationError(Exception): pass
    def _(text): return text

    fields = _MockFields()
    api = _MockAPI()
    models = _MockModels()

try:
    from ..constants import (
        APPROVAL_STATE_PENDING,
        NEGOTIATION_STATUSES,
        NEGOTIATION_STATUS_SUBMITTED,
        NEGOTIATION_STATUS_UNDER_REVIEW,
        NEGOTIATION_STATUS_APPROVED,
        NEGOTIATION_STATUS_REJECTED,
        EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    )
except (ImportError, ValueError):
    from dealflow_odoo.constants import (
        APPROVAL_STATE_PENDING,
        NEGOTIATION_STATUSES,
        NEGOTIATION_STATUS_SUBMITTED,
        NEGOTIATION_STATUS_UNDER_REVIEW,
        NEGOTIATION_STATUS_APPROVED,
        NEGOTIATION_STATUS_REJECTED,
        EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    )

_logger = logging.getLogger(__name__)


class DealFlowNegotiation(models.Model):
    """DealFlow Negotiation Request.
    
    Represents a formal commercial counter-offer or discount negotiation
    submitted by a customer for an existing quotation.
    """
    _name = 'dealflow.negotiation'
    _description = 'DealFlow Negotiation Request'
    _order = 'submitted_at desc, id desc'
    _rec_name = 'name'

    name = fields.Char(
        string='Negotiation Reference',
        required=True,
        copy=False,
        default='New',
        readonly=True,
        index=True,
        help="Unique reference identifier for this negotiation request."
    )
    sale_order_id = fields.Many2one(
        comodel_name='sale.order',
        string='Quotation / Order',
        required=True,
        ondelete='cascade',
        index=True,
        help="The quotation undergoing commercial negotiation."
    )
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Customer',
        related='sale_order_id.partner_id',
        store=True,
        readonly=True,
        index=True,
        help="The customer partner associated with this quotation."
    )
    requested_discount = fields.Float(
        string='Requested Blended Discount %',
        digits=(5, 2),
        default=0.0,
        help="Target blended discount percentage requested by customer."
    )
    requested_terms = fields.Text(
        string='Requested Commercial Terms',
        help="Specific commercial, payment, or delivery terms proposed by customer."
    )
    customer_note = fields.Text(
        string='Customer Justification',
        help="Business justification or budget rationale provided by the customer."
    )
    status = fields.Selection(
        selection=NEGOTIATION_STATUSES,
        string='Status',
        default=NEGOTIATION_STATUS_SUBMITTED,
        required=True,
        copy=False,
        index=True,
        help="Current workflow lifecycle status of the negotiation request."
    )
    original_amount = fields.Float(
        string='Original Amount',
        digits='Account',
        readonly=True,
        help="Quotation total amount prior to negotiation."
    )
    proposed_amount = fields.Float(
        string='Proposed Amount',
        digits='Account',
        help="Customer-proposed total amount calculated from requested discount."
    )
    submitted_at = fields.Datetime(
        string='Submitted At',
        default=fields.Datetime.now,
        readonly=True,
        required=True,
        index=True,
        help="Timestamp when the negotiation request was submitted by the customer."
    )
    reviewed_by = fields.Many2one(
        comodel_name='res.users',
        string='Reviewed By',
        readonly=True,
        help="Internal user (Sales Rep, Manager, or Finance) who reviewed this request."
    )
    review_note = fields.Text(
        string='Review Note',
        help="Internal notes or rationale from the reviewer upon approval or rejection."
    )

    # -------------------------------------------------------------------------
    # CONSTRAINTS & VALIDATIONS
    # -------------------------------------------------------------------------

    @api.constrains('requested_discount')
    def _check_requested_discount(self):
        """Ensure requested discount is within valid bounds (0.0% to 100.0%)."""
        for record in self:
            if record.requested_discount < 0.0 or record.requested_discount > 100.0:
                raise ValidationError(
                    _("Requested discount must be between 0.0%% and 100.0%%. Received: %s%%")
                    % record.requested_discount
                )

    # -------------------------------------------------------------------------
    # CRUD LIFECYCLE
    # -------------------------------------------------------------------------

    @api.model_create_multi
    def create(self, vals_list: List[Dict[str, Any]]):
        """Create negotiation requests with strict authorization and side effects.
        
        Enforces:
        1. Customer ownership verification (IDOR protection).
        2. Auto-generated sequence naming.
        3. Sets sale_order.dealflow_approval_state='pending_approval'.
        4. Sets sale_order.dealflow_locked=True.
        """
        for vals in vals_list:
            order_id = vals.get('sale_order_id')
            if not order_id:
                raise ValidationError(_("A valid sale_order_id is required to create a negotiation request."))

            sale_order = self.env['sale.order'].browse(order_id)
            if not sale_order.exists():
                raise ValidationError(_("Target quotation (ID: %s) does not exist.") % order_id)

            # Strict Customer Ownership Verification (Anti-IDOR Defense)
            user = self.env.user
            is_portal_user = user.has_group('base.group_portal') or user.has_group('dealflow_odoo.group_dealflow_portal')
            if is_portal_user:
                user_partner = user.partner_id
                order_partner = sale_order.partner_id
                is_authorized = (
                    user_partner.id == order_partner.id or
                    (user_partner.commercial_partner_id and order_partner.commercial_partner_id and
                     user_partner.commercial_partner_id.id == order_partner.commercial_partner_id.id) or
                    user_partner.id in order_partner.child_ids.ids or
                    order_partner.id in user_partner.child_ids.ids
                )
                if not is_authorized:
                    _logger.warning(
                        "SECURITY VIOLATION: IDOR attempt by user_id=%s (partner_id=%s) on sale_order_id=%s (partner_id=%s)",
                        user.id, user_partner.id, sale_order.id, order_partner.id
                    )
                    raise AccessError(
                        _("Authorization Violation: You are not authorized to negotiate on quotation %s.")
                        % sale_order.name
                    )

            # Auto-generate reference name
            if vals.get('name', 'New') == 'New':
                seq = self.env['ir.sequence'].next_by_code('dealflow.negotiation')
                if not seq:
                    timestamp_suffix = fields.Datetime.now().strftime('%Y%m%d%H%M%S')
                    seq = f"NEG-{sale_order.name or 'ORDER'}-{timestamp_suffix}"
                vals['name'] = seq

            # Populate amounts
            if 'original_amount' not in vals or not vals['original_amount']:
                vals['original_amount'] = sale_order.amount_total

            if ('proposed_amount' not in vals or not vals['proposed_amount']) and 'requested_discount' in vals:
                req_disc = float(vals.get('requested_discount') or 0.0)
                vals['proposed_amount'] = vals['original_amount'] * max(0.0, (1.0 - (req_disc / 100.0)))

        records = super().create(vals_list)

        # Apply side-effects on the underlying sale.order
        for record in records:
            order = record.sale_order_id
            _logger.info(
                "DealFlow Negotiation %s created for Order %s. Locking order and routing to pending_approval.",
                record.name, order.name
            )

            # Update sale.order status (sudo used because portal customer cannot write sale.order)
            update_vals = {
                'dealflow_approval_state': APPROVAL_STATE_PENDING,
                'dealflow_locked': True,
            }
            try:
                order.sudo().write(update_vals)
            except Exception as ex:
                _logger.warning("Could not write dealflow fields on sale.order %s: %s", order.id, ex)

            # Post notification to order chatter
            try:
                order.sudo().message_post(
                    body=_(
                        "<b>DealFlow: Customer Negotiation Submitted</b><br/>"
                        "<b>Reference:</b> %s<br/>"
                        "<b>Requested Discount:</b> %s%%<br/>"
                        "<b>Proposed Total:</b> %s<br/>"
                        "<b>Terms:</b> %s<br/>"
                        "<b>Customer Justification:</b> %s<br/>"
                        "<i>Quotation has been locked pending internal review.</i>"
                    ) % (
                        record.name,
                        record.requested_discount,
                        record.proposed_amount,
                        record.requested_terms or _("N/A"),
                        record.customer_note or _("N/A"),
                    ),
                    subtype_xmlid='mail.mt_note',
                )
            except Exception as chatter_err:
                _logger.debug("Chatter notification skipped: %s", chatter_err)

        return records

    # -------------------------------------------------------------------------
    # WORKFLOW ACTIONS
    # -------------------------------------------------------------------------

    def action_under_review(self):
        """Mark negotiation as actively being evaluated by sales team."""
        for record in self:
            record.write({
                'status': NEGOTIATION_STATUS_UNDER_REVIEW,
                'reviewed_by': self.env.user.id,
            })
        return True

    def action_approve(self, review_note: Optional[str] = None):
        """Approve the negotiation request and unlock the quote."""
        for record in self:
            vals: Dict[str, Any] = {
                'status': NEGOTIATION_STATUS_APPROVED,
                'reviewed_by': self.env.user.id,
            }
            if review_note:
                vals['review_note'] = review_note
            record.write(vals)

            # Unlock quotation upon approved negotiation
            try:
                record.sale_order_id.sudo().write({
                    'dealflow_locked': False,
                    'dealflow_approval_state': 'approved',
                })
            except Exception as ex:
                _logger.warning("Could not update sale.order on approval: %s", ex)
        return True

    def action_reject(self, review_note: Optional[str] = None):
        """Reject the negotiation request."""
        for record in self:
            vals: Dict[str, Any] = {
                'status': NEGOTIATION_STATUS_REJECTED,
                'reviewed_by': self.env.user.id,
            }
            if review_note:
                vals['review_note'] = review_note
            record.write(vals)

            # Unlock quotation upon rejection
            try:
                record.sale_order_id.sudo().write({
                    'dealflow_locked': False,
                    'dealflow_approval_state': 'rejected',
                })
            except Exception as ex:
                _logger.warning("Could not update sale.order on rejection: %s", ex)
        return True
