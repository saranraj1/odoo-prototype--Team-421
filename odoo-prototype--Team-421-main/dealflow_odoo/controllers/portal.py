# -*- coding: utf-8 -*-
"""DealFlow360 — Customer Portal & Negotiation Controller.

Provides secure, authorization-safe, customer-isolated endpoints for quotation viewing
and counter-offer negotiation. Strictly prevents Insecure Direct Object References (IDOR),
data tampering, and leaks of sensitive internal pricing metrics (margins/costs).
"""

import json
import logging
from typing import Any, Dict, Optional

try:
    from odoo import fields, http, _
    from odoo.http import request, Response
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

    class _MockHTTP:
        class Controller:
            pass
        @staticmethod
        def route(*args, **kwargs):
            def decorator(f): return f
            return decorator

    class Response:
        def __init__(self, response=None, status=200, mimetype='application/json'):
            self.response = response
            self.status_code = status
            self.mimetype = mimetype
            self.data = response.encode('utf-8') if isinstance(response, str) else response

    class _MockRequest:
        env = type("Env", (), {"user": None})()
        session = type("Session", (), {"uid": None})()
        httprequest = type("HttpRequest", (), {"data": b""})()
        params = {}

    http = _MockHTTP()
    fields = _MockFields()
    request = _MockRequest()
    def _(text): return text

try:
    from ..constants import (
        APPROVAL_STATE_PENDING,
        EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
        ERR_AUTHORIZATION,
        ERR_NOT_FOUND,
        ERR_VALIDATION,
    )
except (ImportError, ValueError):
    from dealflow_odoo.constants import (
        APPROVAL_STATE_PENDING,
        EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
        ERR_AUTHORIZATION,
        ERR_NOT_FOUND,
        ERR_VALIDATION,
    )

_logger = logging.getLogger(__name__)


class PortalController(http.Controller):
    """DealFlow Customer Portal Controller.
    
    Handles customer portal quotation presentation and negotiation submission.
    """

    # -------------------------------------------------------------------------
    # HELPER UTILITIES
    # -------------------------------------------------------------------------

    def _json_response(self, data: Dict[str, Any], status: int = 200) -> Response:
        """Helper to return consistent JSON HTTP responses across all Odoo environments."""
        return Response(
            json.dumps(data, default=str),
            status=status,
            mimetype='application/json'
        )

    def _json_error(self, code: str, message: str, status: int = 400, details: Optional[Dict[str, Any]] = None) -> Response:
        """Helper to return consistent error payloads."""
        payload = {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            }
        }
        return self._json_response(payload, status=status)

    def _get_request_json(self) -> Dict[str, Any]:
        """Safely parse request payload whether passed as JSON body or form parameters."""
        try:
            if request.httprequest.data:
                parsed = json.loads(request.httprequest.data.decode('utf-8'))
                if isinstance(parsed, dict):
                    return parsed
                return {}
        except Exception:
            pass
        params = request.params
        if isinstance(params, dict):
            return params
        return {}

    def _get_authenticated_user(self):
        """Retrieve authenticated user or None if public/unauthenticated."""
        if not hasattr(request, 'env'):
            return None
        user = getattr(request.env, 'user', None)
        if not user or (hasattr(user, '_is_public') and user._is_public()) or not getattr(user, 'id', None):
            return None
        return user

    def _validate_order_authorization(self, user, order) -> bool:
        """Enforce strict server-side ownership authorization.
        
        NEVER trust /dealflow/portal/deal/<id> or /customer/deal/<id> simply
        because ID is valid. Authorization is strictly verified against
        the logged-in customer partner_id and commercial partner hierarchy.
        """
        # Internal users: DealFlow Admin, Manager, Finance, or assigned Rep
        if user.has_group('base.group_user'):
            is_elevated = (
                user.has_group('dealflow_odoo.group_dealflow_admin') or
                user.has_group('dealflow_odoo.group_dealflow_sales_manager') or
                user.has_group('dealflow_odoo.group_dealflow_finance')
            )
            if is_elevated:
                return True
            # Sales Rep: strictly limited to orders assigned to them
            order_user_id = getattr(order.user_id, 'id', None)
            if order_user_id and order_user_id == user.id:
                return True
            return False

        # External Customer / Portal User: Strictly matched against partner_id
        user_partner = user.partner_id
        order_partner = order.partner_id

        if not user_partner or not order_partner:
            return False

        # Match exact partner, commercial partner, or parent-child hierarchy
        is_owner = (
            user_partner.id == order_partner.id or
            (user_partner.commercial_partner_id and order_partner.commercial_partner_id and
             user_partner.commercial_partner_id.id == order_partner.commercial_partner_id.id) or
            user_partner.id in order_partner.child_ids.ids or
            order_partner.id in user_partner.child_ids.ids
        )
        return is_owner

    def _emit_event(self, event_type: str, event_payload: Dict[str, Any]):
        """Emit DealFlow domain event for subscribers, webhooks, and audit logs."""
        _logger.info(
            "DealFlow Domain Event [%s] Emitted: record_id=%s, actor_id=%s",
            event_type, event_payload.get('record_id'), event_payload.get('actor_id')
        )
        # 1. Post to order chatter for immediate sales visibility
        order_id = event_payload.get('order_id')
        if order_id:
            try:
                order = request.env['sale.order'].sudo().browse(order_id)
                if order.exists():
                    data = event_payload.get('data', {})
                    order.message_post(
                        body=_(
                            "<b>DealFlow Event: %s</b><br/>"
                            "Customer submitted negotiation request: <b>%s</b><br/>"
                            "Requested Discount: <b>%s%%</b><br/>"
                            "Proposed Total: <b>%s</b>"
                        ) % (
                            event_type,
                            data.get('negotiation_name', 'N/A'),
                            data.get('requested_discount', 0.0),
                            data.get('proposed_amount', 0.0),
                        ),
                        subtype_xmlid='mail.mt_note'
                    )
            except Exception as chatter_err:
                _logger.debug("Chatter log skipped: %s", chatter_err)

        # 2. Dispatch via DealFlow EventDispatcher service
        try:
            try:
                from dealflow_odoo.services.event_dispatcher import get_event_dispatcher
            except ImportError:
                from ..services.event_dispatcher import get_event_dispatcher
            dispatcher = get_event_dispatcher()
            dispatcher.dispatch(
                event_type=event_type,
                record_id=event_payload.get('record_id', 0),
                model=event_payload.get('model', 'dealflow.negotiation'),
                data=event_payload.get('data', {}),
                deal_id=event_payload.get('dealflow_deal_id'),
                actor_id=event_payload.get('actor_id'),
            )
        except Exception as disp_err:
            _logger.debug("EventDispatcher dispatch skipped/unavailable: %s", disp_err)

    # -------------------------------------------------------------------------
    # ROUTES
    # -------------------------------------------------------------------------

    @http.route(
        ['/dealflow/portal/deal/<int:order_id>', '/customer/deal/<int:order_id>'],
        type='http',
        auth='public',
        methods=['GET'],
        csrf=False
    )
    def portal_get_deal(self, order_id: int, **kwargs) -> Response:
        """Securely fetch quotation details for customer portal view.
        
        Security Invariants:
        1. User must be authenticated.
        2. Customer partner_id must match quotation partner_id (IDOR defense).
        3. Internal margins, costs, and risk scores are STRICTLY EXCLUDED from payload.
        """
        user = self._get_authenticated_user()
        if not user:
            return self._json_error(
                "AUTHENTICATION_REQUIRED",
                "Authentication required to view this quotation.",
                status=401
            )

        try:
            order_id = int(order_id)
        except (ValueError, TypeError):
            return self._json_error(
                ERR_VALIDATION,
                "Parameter order_id must be a valid integer.",
                status=400
            )

        if order_id <= 0:
            return self._json_error(
                ERR_NOT_FOUND,
                f"Quotation with ID {order_id} not found.",
                status=404
            )

        order = request.env['sale.order'].sudo().browse(order_id)
        if not order.exists():
            return self._json_error(
                ERR_NOT_FOUND,
                f"Quotation with ID {order_id} not found.",
                status=404
            )

        # Anti-IDOR Authorization Check
        if not self._validate_order_authorization(user, order):
            _logger.warning(
                "IDOR PREVENTED: User %s (partner %s) attempted to read Order %s (partner %s)",
                user.id, user.partner_id.id, order.id, order.partner_id.id
            )
            return self._json_error(
                ERR_AUTHORIZATION,
                "Forbidden: You do not have permission to access this quotation.",
                status=403
            )

        # Build Safe View Payload — Excludes internal margins, costs, and risk algorithms
        safe_lines = []
        for line in order.order_line:
            safe_lines.append({
                "id": line.id,
                "product_id": line.product_id.id,
                "product_name": line.product_id.display_name or line.name,
                "description": line.name,
                "quantity": float(line.product_uom_qty),
                "uom": line.product_uom.name if hasattr(line, 'product_uom') and line.product_uom else "Units",
                "price_unit": float(line.price_unit),
                "discount": float(line.discount),
                "price_subtotal": float(line.price_subtotal),
                "price_total": float(getattr(line, 'price_total', line.price_subtotal)),
                # STRICT EXCLUSION: NO cost_price, standard_price, margin, or margin_percent!
            })

        # Fetch existing negotiation requests on this order
        negotiations = request.env['dealflow.negotiation'].sudo().search(
            [('sale_order_id', '=', order.id)],
            order='submitted_at desc'
        )
        safe_negotiations = []
        for neg in negotiations:
            safe_negotiations.append({
                "id": neg.id,
                "name": neg.name,
                "status": neg.status,
                "requested_discount": float(neg.requested_discount),
                "requested_terms": neg.requested_terms,
                "customer_note": neg.customer_note,
                "original_amount": float(neg.original_amount),
                "proposed_amount": float(neg.proposed_amount),
                "submitted_at": fields.Datetime.to_string(neg.submitted_at),
                "review_note": neg.review_note if neg.status in ('approved', 'rejected') else None,
            })

        payload = {
            "success": True,
            "data": {
                "order_id": order.id,
                "name": order.name,
                "state": order.state,
                "date_order": fields.Datetime.to_string(order.date_order) if order.date_order else None,
                "customer": {
                    "id": order.partner_id.id,
                    "name": order.partner_id.name,
                    "email": order.partner_id.email,
                },
                "currency": {
                    "name": order.currency_id.name if order.currency_id else "USD",
                    "symbol": order.currency_id.symbol if order.currency_id else "$",
                },
                "pricing": {
                    "amount_untaxed": float(order.amount_untaxed),
                    "amount_tax": float(order.amount_tax),
                    "amount_total": float(order.amount_total),
                },
                "governance": {
                    "dealflow_approval_state": getattr(order, 'dealflow_approval_state', 'draft'),
                    "dealflow_locked": bool(getattr(order, 'dealflow_locked', False)),
                },
                "lines": safe_lines,
                "negotiations": safe_negotiations,
            }
        }
        return self._json_response(payload, status=200)

    @http.route(
        '/dealflow/portal/negotiate',
        type='http',
        auth='public',
        methods=['POST'],
        csrf=False
    )
    def portal_submit_negotiation(self, **kwargs) -> Response:
        """Submit a customer counter-offer negotiation request.
        
        Security Invariants:
        1. User must be authenticated.
        2. Customer partner_id must match quotation partner_id.
        3. Customer CANNOT edit sale.order directly; a dealflow.negotiation record is created.
        4. Quotation is locked and routed to pending approval.
        5. Emits customer.negotiation.submitted event.
        6. Returns 201 Created.
        """
        user = self._get_authenticated_user()
        if not user:
            return self._json_error(
                "AUTHENTICATION_REQUIRED",
                "Authentication required to submit negotiation.",
                status=401
            )

        data = self._get_request_json()
        if not isinstance(data, dict) or not data:
            return self._json_error(
                ERR_VALIDATION,
                "Request payload cannot be empty.",
                status=400
            )

        # Validate order_id
        order_id = data.get('order_id')
        if not order_id:
            return self._json_error(
                ERR_VALIDATION,
                "Missing required parameter: order_id",
                status=400
            )

        try:
            order_id = int(order_id)
        except (ValueError, TypeError):
            return self._json_error(
                ERR_VALIDATION,
                "Parameter order_id must be a valid integer.",
                status=400
            )

        if order_id <= 0:
            return self._json_error(
                ERR_NOT_FOUND,
                f"Quotation with ID {order_id} not found.",
                status=404
            )

        order = request.env['sale.order'].sudo().browse(order_id)
        if not order.exists():
            return self._json_error(
                ERR_NOT_FOUND,
                f"Quotation with ID {order_id} not found.",
                status=404
            )

        # Anti-IDOR Authorization Check
        if not self._validate_order_authorization(user, order):
            _logger.warning(
                "IDOR PREVENTED: User %s attempted negotiation on Order %s belonging to partner %s",
                user.id, order.id, order.partner_id.id
            )
            return self._json_error(
                ERR_AUTHORIZATION,
                "Forbidden: You do not have permission to negotiate on this quotation.",
                status=403
            )

        # Validate quotation state
        if order.state in ('cancel', 'done'):
            return self._json_error(
                "INVALID_STATE",
                f"Cannot negotiate quotation in '{order.state}' state.",
                status=400
            )

        # Extract negotiation parameters
        try:
            requested_discount = float(data.get('requested_discount', 0.0))
        except (ValueError, TypeError):
            return self._json_error(
                ERR_VALIDATION,
                "requested_discount must be a valid float percentage.",
                status=400
            )

        if requested_discount < 0.0 or requested_discount > 100.0:
            return self._json_error(
                ERR_VALIDATION,
                "requested_discount must be between 0.0% and 100.0%.",
                status=400
            )

        import html
        raw_terms = str(data.get('requested_terms') or '')
        raw_note = str(data.get('customer_note') or '')
        # Sanitize HTML tags to neutralize XSS injection attacks
        requested_terms = html.escape(raw_terms)
        customer_note = html.escape(raw_note)
        # STRICT SERVER-SIDE ENFORCEMENT: Client-supplied baseline amount is strictly ignored (VULN-07)
        original_amount = float(order.amount_total)
        calculated_proposed = round(original_amount * max(0.0, 1.0 - (requested_discount / 100.0)), 2)

        proposed_amount = data.get('proposed_amount')
        if proposed_amount is not None:
            try:
                proposed_amount = float(proposed_amount)
                if proposed_amount < 0.0 or proposed_amount > original_amount:
                    proposed_amount = calculated_proposed
            except (ValueError, TypeError):
                proposed_amount = calculated_proposed
        else:
            proposed_amount = calculated_proposed

        # Create dealflow.negotiation record (Customer NEVER edits sale.order directly)
        try:
            negotiation_vals = {
                'sale_order_id': order.id,
                'requested_discount': requested_discount,
                'requested_terms': requested_terms,
                'customer_note': customer_note,
                'original_amount': original_amount,
                'proposed_amount': proposed_amount,
                'status': 'submitted',
            }
            negotiation = request.env['dealflow.negotiation'].sudo().create(negotiation_vals)
        except Exception as err:
            _logger.exception("Failed to create dealflow.negotiation: %s", err)
            return self._json_error(
                "NEGOTIATION_CREATION_FAILED",
                f"Failed to submit negotiation request: {str(err)}",
                status=500
            )

        # Emit customer.negotiation.submitted event
        event_payload = {
            "event_type": EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
            "timestamp": fields.Datetime.to_string(fields.Datetime.now()),
            "actor_id": user.id,
            "actor_name": user.name,
            "record_id": negotiation.id,
            "model": "dealflow.negotiation",
            "order_id": order.id,
            "order_name": order.name,
            "customer_id": order.partner_id.id,
            "customer_name": order.partner_id.name,
            "dealflow_deal_id": f"DEAL-{order.id}",
            "data": {
                "negotiation_id": negotiation.id,
                "negotiation_name": negotiation.name,
                "requested_discount": negotiation.requested_discount,
                "requested_terms": negotiation.requested_terms,
                "customer_note": negotiation.customer_note,
                "original_amount": negotiation.original_amount,
                "proposed_amount": negotiation.proposed_amount,
                "status": negotiation.status,
            }
        }
        self._emit_event(EVENT_CUSTOMER_NEGOTIATION_SUBMITTED, event_payload)

        # Return 201 Created with negotiation details
        response_payload = {
            "success": True,
            "message": "Negotiation request submitted successfully.",
            "data": {
                "negotiation_id": negotiation.id,
                "negotiation_name": negotiation.name,
                "sale_order_id": order.id,
                "sale_order_name": order.name,
                "status": negotiation.status,
                "requested_discount": negotiation.requested_discount,
                "requested_terms": negotiation.requested_terms,
                "customer_note": negotiation.customer_note,
                "original_amount": negotiation.original_amount,
                "proposed_amount": negotiation.proposed_amount,
                "submitted_at": fields.Datetime.to_string(negotiation.submitted_at),
                "sale_order_approval_state": getattr(order, 'dealflow_approval_state', APPROVAL_STATE_PENDING),
                "sale_order_locked": bool(getattr(order, 'dealflow_locked', True)),
            },
            "event": event_payload
        }
        return self._json_response(response_payload, status=201)
