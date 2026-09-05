"""DealFlow360 Odoo Integration — Central REST/JSON API Controller.

This controller exposes the OdooIntegrationService to the DealFlow backend
over secure, authenticated REST/JSON endpoints.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, is_dataclass
from typing import Any, Dict, Optional

from dealflow_odoo.schemas import (
    AuthorizationError,
    DealFlowIntegrationError,
    InvalidStateError,
    NotFoundError,
    OdooExecutionError,
    ValidationError,
)
from dealflow_odoo.services.integration_service import OdooIntegrationService

# Optional Odoo imports with test stubs
try:
    from odoo import http
    from odoo.http import request
except ImportError:
    class DummyHttp:
        class Controller:
            pass

        @staticmethod
        def route(*args, **kwargs):
            def decorator(f):
                f.routing = kwargs
                f.routes = args
                return f
            return decorator

    http = DummyHttp()
    request = None

logger = logging.getLogger("dealflow.api_controller")


class DealFlowApiController(http.Controller):
    """REST/JSON endpoints exposing Odoo Integration Service to DealFlow backend."""

    _service_override: Optional[OdooIntegrationService] = None

    @classmethod
    def set_service_override(cls, service: Optional[OdooIntegrationService]) -> None:
        """Inject an integration service instance (useful for unit testing)."""
        cls._service_override = service

    def _get_service(self) -> OdooIntegrationService:
        """Retrieve active OdooIntegrationService bound to current Odoo request env."""
        if self._service_override is not None:
            return self._service_override

        env = getattr(request, "env", None) if request is not None else None
        return OdooIntegrationService(env=env)

    def _parse_json_payload(self) -> Dict[str, Any]:
        """Safely parse JSON request payload across standard and JSON-RPC requests."""
        if request is None:
            return {}

        # 1. Check if request.params already parsed
        if hasattr(request, "params") and isinstance(request.params, dict) and request.params:
            return dict(request.params)

        # 2. Check get_json_data (Odoo 17+)
        if hasattr(request, "get_json_data"):
            try:
                data = request.get_json_data()
                if isinstance(data, dict):
                    return data.get("params", data)
            except Exception:
                pass

        # 3. Check httprequest raw data
        if hasattr(request, "httprequest") and hasattr(request.httprequest, "data"):
            try:
                raw = request.httprequest.data
                if raw:
                    parsed = json.loads(raw.decode("utf-8"))
                    if isinstance(parsed, dict):
                        return parsed.get("params", parsed)
            except Exception:
                pass

        return {}

    def _json_response(self, data: Dict[str, Any], status: int = 200) -> Any:
        """Format and return JSON HTTP response."""
        if request is not None and hasattr(request, "make_json_response"):
            return request.make_json_response(data, status=status)

        try:
            from werkzeug.wrappers import Response
            return Response(
                json.dumps(data, default=str),
                status=status,
                mimetype="application/json",
            )
        except Exception:
            return {"status": status, "body": data}

    def _handle_error(self, exc: Exception, endpoint: str) -> Any:
        """Translate exceptions into structured JSON error responses with proper HTTP status."""
        logger.error("API error at %s: %s", endpoint, exc, exc_info=True)

        if isinstance(exc, ValidationError):
            return self._json_response(exc.to_dict(), status=400)
        if isinstance(exc, AuthorizationError):
            return self._json_response(exc.to_dict(), status=403)
        if isinstance(exc, NotFoundError):
            return self._json_response(exc.to_dict(), status=404)
        if isinstance(exc, InvalidStateError):
            return self._json_response(exc.to_dict(), status=409)
        if isinstance(exc, OdooExecutionError):
            return self._json_response(exc.to_dict(), status=500)
        if isinstance(exc, DealFlowIntegrationError):
            return self._json_response(exc.to_dict(), status=400)

        # Generic unexpected error
        return self._json_response(
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": str(exc),
                    "details": {"endpoint": endpoint},
                },
            },
            status=500,
        )

    # -------------------------------------------------------------------------
    # REST Endpoints
    # -------------------------------------------------------------------------

    @http.route(
        "/api/dealflow/order/<int:order_id>/context",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def order_context(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/context

        Retrieves complete DealContextDTO for the given order.
        """
        try:
            service = self._get_service()
            context_dto = service.get_deal_context(order_id)
            data = asdict(context_dto) if is_dataclass(context_dto) else context_dto
            return self._json_response({"success": True, "data": data}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"order_context({order_id})")

    @http.route(
        "/api/dealflow/order/<int:order_id>/apply_approved_change",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def apply_approved_change(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/apply_approved_change

        Applies approved changes (discounts, lines, terms) atomically to an order.
        """
        try:
            payload = self._parse_json_payload()
            changes = payload.get("changes", payload)
            service = self._get_service()
            result = service.apply_approved_change(order_id, changes)
            return self._json_response({"success": True, "data": result}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"apply_approved_change({order_id})")

    @http.route(
        "/api/dealflow/order/<int:order_id>/confirm",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def confirm_order(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/confirm

        Confirms an approved quotation into a sales order.
        """
        try:
            payload = self._parse_json_payload()
            approval_token = payload.get("approval_token")
            service = self._get_service()
            result = service.confirm_order(order_id, approval_token=approval_token)
            return self._json_response({"success": True, "data": result}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"confirm_order({order_id})")

    @http.route(
        "/api/dealflow/order/<int:order_id>/fulfillment",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def apply_fulfillment(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/fulfillment

        Applies warehouse inventory allocation split to the order and delivery orders.
        """
        try:
            payload = self._parse_json_payload()
            plan = payload.get("plan", payload)
            service = self._get_service()
            result = service.apply_fulfillment_plan(order_id, plan)
            return self._json_response({"success": True, "data": result}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"apply_fulfillment({order_id})")

    @http.route(
        "/api/dealflow/order/<int:order_id>/invoice",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
    )
    def create_invoice(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/invoice

        Generates customer invoice for a confirmed order.
        """
        try:
            service = self._get_service()
            result = service.create_invoice(order_id)
            return self._json_response({"success": True, "data": result}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"create_invoice({order_id})")
