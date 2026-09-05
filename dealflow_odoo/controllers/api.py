"""DealFlow360 Odoo Integration — Central REST/JSON API Controller.

This controller exposes the OdooIntegrationService to the DealFlow backend
over secure, authenticated REST/JSON endpoints.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import asdict, is_dataclass
from typing import Any, Dict, Optional

from dealflow_odoo.schemas import (
    AuthenticationError,
    AuthorizationError,
    DealFlowIntegrationError,
    InvalidStateError,
    NotFoundError,
    OdooExecutionError,
    ValidationError,
)
from dealflow_odoo.security.security_utils import verify_api_key
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
    _api_key_override: Optional[str] = None
    _enforce_auth_in_test: bool = False

    @classmethod
    def set_service_override(cls, service: Optional[OdooIntegrationService]) -> None:
        """Inject an integration service instance (useful for unit testing)."""
        cls._service_override = service

    @classmethod
    def set_api_key(cls, key: Optional[str]) -> None:
        """Configure API key override (useful for testing or runtime configuration)."""
        cls._api_key_override = key

    @classmethod
    def set_enforce_auth_in_test(cls, enforce: bool) -> None:
        """Enable or disable authentication enforcement during test fixture execution."""
        cls._enforce_auth_in_test = enforce

    def _get_expected_api_key(self) -> str:
        """Resolve the expected API key from parameter override, Odoo settings, or environment."""
        if self._api_key_override:
            return self._api_key_override

        env = getattr(request, "env", None) if request is not None else None
        if env is not None:
            try:
                param_key = env["ir.config_parameter"].sudo().get_param("dealflow.api_key")
                if param_key:
                    return str(param_key).strip()
            except Exception:
                pass

        return os.environ.get("DEALFLOW_API_KEY", "dealflow_api_secret_key_default")

    def _extract_auth_token(self) -> Optional[str]:
        """Extract API Key from Bearer Authorization header, X-API-Key header, or payload parameters."""
        if request is None:
            return None

        # 1. Check HTTP headers
        httpreq = getattr(request, "httprequest", None)
        if httpreq is not None:
            headers = getattr(httpreq, "headers", None)
            if headers is not None:
                auth = headers.get("Authorization") or headers.get("authorization")
                if auth and auth.startswith("Bearer "):
                    return auth[7:].strip()
                x_key = headers.get("X-API-Key") or headers.get("x-api-key")
                if x_key:
                    return x_key.strip()
            environ = getattr(httpreq, "environ", {}) or {}
            auth_env = environ.get("HTTP_AUTHORIZATION")
            if auth_env and auth_env.startswith("Bearer "):
                return auth_env[7:].strip()
            x_key_env = environ.get("HTTP_X_API_KEY")
            if x_key_env:
                return x_key_env.strip()

        # 2. Check query or request params
        params = getattr(request, "params", {}) or {}
        if isinstance(params, dict):
            key = params.get("api_key") or params.get("auth_token")
            if key and isinstance(key, str):
                return key.strip()

        # 3. Check JSON payload
        payload = self._parse_json_payload()
        if isinstance(payload, dict):
            key = payload.get("api_key") or payload.get("auth_token")
            if key and isinstance(key, str):
                return key.strip()

        return None

    def _authenticate_request(self) -> None:
        """Enforces authentication via API Key, Bearer Token, or active non-public Odoo session.

        Raises:
            AuthenticationError: If caller lacks valid authentication credentials.
        """
        if self._service_override is not None and not self._enforce_auth_in_test:
            return

        # 1. Check for active internal/admin Odoo session
        env = getattr(request, "env", None) if request is not None else None
        user = getattr(env, "user", None) if env is not None else None
        if user and getattr(user, "id", None):
            is_public = getattr(user, "_is_public", lambda: False)()
            if not is_public and (user.has_group("base.group_user") or user.has_group("dealflow_odoo.group_dealflow_admin")):
                return

        # 2. Check API Key
        provided_key = self._extract_auth_token()
        expected_key = self._get_expected_api_key()

        if provided_key and verify_api_key(provided_key, expected_key):
            return

        logger.warning("Unauthenticated API request rejected: missing or invalid credentials")
        raise AuthenticationError(
            "Authentication required: missing or invalid API key / bearer token.",
            details={"code": "AUTHENTICATION_REQUIRED"},
        )

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

        if isinstance(exc, AuthenticationError):
            return self._json_response(exc.to_dict(), status=401)
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

        # Generic unexpected error — sanitized to prevent traceback leakage
        error_ref = uuid.uuid4().hex[:8].upper()
        logger.exception("Internal error at %s (Ref: %s): %s", endpoint, error_ref, exc)
        return self._json_response(
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": f"An unexpected internal server error occurred (Ref: {error_ref}).",
                    "details": {"endpoint": endpoint, "error_ref": error_ref},
                },
            },
            status=500,
        )

    # -------------------------------------------------------------------------
    # REST Endpoints
    # -------------------------------------------------------------------------

    @http.route(
        "/api/dealflow/health",
        type="http",
        auth="public",
        methods=["GET"],
        cors="*",
        csrf=False,
    )
    def health_check(self, **_kwargs) -> Any:
        """GET /api/dealflow/health

        Readiness and liveness probe for monitoring, orchestrators, and frontend clients.
        """
        from datetime import datetime, timezone
        return self._json_response(
            {
                "success": True,
                "status": "healthy",
                "service": "DealFlow360 Odoo Integration",
                "version": "18.0.1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            status=200,
        )

    @http.route(
        "/api/dealflow/order/<int:order_id>/context",
        type="http",
        auth="public",
        methods=["GET", "POST"],
        cors="*",
        csrf=False,
    )
    def order_context(self, order_id: int, **_kwargs) -> Any:
        """GET/POST /api/dealflow/order/<int:order_id>/context

        Retrieves complete DealContextDTO for the given order.
        """
        try:
            self._authenticate_request()
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
        cors="*",
        csrf=False,
    )
    def apply_approved_change(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/apply_approved_change

        Applies approved changes (discounts, lines, terms) atomically to an order.
        """
        try:
            self._authenticate_request()
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
        cors="*",
        csrf=False,
    )
    def confirm_order(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/confirm

        Confirms an approved quotation into a sales order.
        """
        try:
            self._authenticate_request()
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
        cors="*",
        csrf=False,
    )
    def apply_fulfillment(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/fulfillment

        Applies warehouse inventory allocation split to the order and delivery orders.
        """
        try:
            self._authenticate_request()
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
        cors="*",
        csrf=False,
    )
    def create_invoice(self, order_id: int, **_kwargs) -> Any:
        """POST /api/dealflow/order/<int:order_id>/invoice

        Generates customer invoice for a confirmed order.
        """
        try:
            self._authenticate_request()
            service = self._get_service()
            result = service.create_invoice(order_id)
            return self._json_response({"success": True, "data": result}, status=200)
        except Exception as exc:
            return self._handle_error(exc, f"create_invoice({order_id})")
