# -*- coding: utf-8 -*-
"""DealFlow360 — Principal Stress Test Suite: Integration Service & Fault Injection.

This test suite executes brutal fault injection and concurrency attacks against:
1. Webhook & Listener Fault Injection (timeout, HTTP 500, exploding listeners).
2. Audit Trail Completeness & Tamper Resistance (10 rapid operations, failure recording, tamper defense, buffer capacity).
3. Error Mapping Consistency & Traceback Containment (Odoo exceptions mapped to canonical DealFlowIntegrationError hierarchy, zero raw tracebacks).
4. Concurrency & High Throughput (rapid dispatch of 100+ events, thread safety, buffer eviction, tamper defense).
"""

from __future__ import annotations

import copy
import json
import socket
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    APPROVAL_STATE_REJECTED,
    EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    EVENT_DISCOUNT_CHANGED,
    EVENT_INVOICE_CREATED,
    EVENT_ORDER_APPROVED,
    EVENT_ORDER_CONFIRMED,
    EVENT_PAYMENT_RECORDED,
    EVENT_SALE_ORDER_CHANGED,
    EVENT_STOCK_CHANGED,
)
import dealflow_odoo.controllers.api as api_module
from dealflow_odoo.controllers.api import DealFlowApiController
from dealflow_odoo.security.security_utils import generate_approval_token
from dealflow_odoo.schemas import (
    AuthorizationError,
    CustomerDTO,
    DealContextDTO,
    DealFlowIntegrationError,
    EventPayloadDTO,
    FulfillmentPlanDTO,
    InvalidStateError,
    NegotiationRequestDTO,
    NotFoundError,
    OdooExecutionError,
    OrderLineDTO,
    ProductDTO,
    ValidationError,
)
from dealflow_odoo.services.event_dispatcher import EventDispatcher
from dealflow_odoo.services.integration_service import (
    OdooAccessDenied,
    OdooAccessError,
    OdooExecutionError,
    OdooIntegrationService,
    OdooMissingError,
    OdooUserError,
    OdooValidationError,
)


# =============================================================================
# MOCK REQUEST HELPER FOR API CONTROLLER TESTS
# =============================================================================

class MockHttpRequest:
    def __init__(self, data: bytes = b""):
        self.data = data


class MockApiRequest:
    def __init__(self, env: Any = None, params: Optional[Dict[str, Any]] = None, data: Any = None):
        self.env = env
        self.params = dict(params or {})
        raw_bytes = json.dumps(data).encode("utf-8") if data is not None else b""
        self.httprequest = MockHttpRequest(raw_bytes)

    def get_json_data(self) -> Dict[str, Any]:
        if self.httprequest.data:
            try:
                return json.loads(self.httprequest.data.decode("utf-8"))
            except Exception:
                return {}
        return self.params

    def make_json_response(self, data: Dict[str, Any], status: int = 200) -> Any:
        from werkzeug.wrappers import Response
        return Response(
            json.dumps(data, default=str),
            status=status,
            mimetype="application/json",
        )


@pytest.fixture
def mock_api_request_context():
    """Sets up and tears down simulated request context for DealFlowApiController."""
    original_request = getattr(api_module, "request", None)

    def _setter(env: Any = None, params: Optional[Dict[str, Any]] = None, data: Any = None) -> MockApiRequest:
        req = MockApiRequest(env=env, params=params, data=data)
        api_module.request = req
        return req

    yield _setter
    api_module.request = original_request
    DealFlowApiController.set_service_override(None)


@pytest.fixture(autouse=True)
def clean_event_dispatcher(integration_service):
    """Ensure event dispatcher has clean state without leftover webhooks before and after each test."""
    if hasattr(integration_service, "event_dispatcher"):
        integration_service.event_dispatcher.clear()
    yield
    if hasattr(integration_service, "event_dispatcher"):
        integration_service.event_dispatcher.clear()


# =============================================================================
# TEST SUITE 1: WEBHOOK & LISTENER FAULT INJECTION
# =============================================================================

class TestWebhookAndListenerFaultInjection:
    """Brutally injects faults into event dispatcher webhooks and listener callbacks.

    Verifies that webhook failures (HTTP 500, timeouts, connection refused) and
    listener exceptions NEVER crash business operations.
    """

    def test_webhook_timeout_does_not_crash_transaction(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Webhook endpoint times out (socket/URL timeout).

        Verify that EventDispatcher logs the failure, returns False from notify_dealflow,
        and DOES NOT crash the business transaction (confirm_order).
        """
        dispatcher = integration_service.event_dispatcher
        webhook_url = "https://dealflow.backend.internal/events/order_confirmed"
        dispatcher.register_webhook(webhook_url)

        # Prepare quotation for confirmation
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_APPROVED
        sample_quotation.dealflow_locked = False

        # Mock urllib.request.urlopen to simulate a socket timeout error
        timeout_exc = urllib.error.URLError(socket.timeout("Connection timed out to webhook endpoint"))

        with patch("urllib.request.urlopen", side_effect=timeout_exc) as mock_urlopen, \
             patch("dealflow_odoo.services.event_dispatcher.urllib.request.urlopen", side_effect=timeout_exc):
            try:
                # Execute business transaction
                result = integration_service.confirm_order(sample_quotation.id)

                assert mock_urlopen.called
                assert result.get("confirmed") is True
                assert sample_quotation.state == "sale"
            finally:
                dispatcher.clear()

        # Verify event was nevertheless captured in memory
        recent_events = dispatcher.get_recent_events(limit=5)
        confirmed_events = [e for e in recent_events if e["event_type"] == EVENT_ORDER_CONFIRMED]
        assert len(confirmed_events) == 1
        assert confirmed_events[0]["record_id"] == sample_quotation.id

        # Verify audit log recorded SUCCESS for confirm_order
        latest_audit = integration_service.get_audit_logs(limit=1)[0]
        assert latest_audit["operation"] == "confirm_order"
        assert latest_audit["result"] == "SUCCESS"

    def test_webhook_http_500_does_not_crash_transaction(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Webhook returns HTTP 500 Internal Server Error.

        Verify that EventDispatcher captures the HTTP 500 and does NOT crash update_order.
        """
        dispatcher = integration_service.event_dispatcher
        webhook_url = "https://dealflow.backend.internal/events/discount_changed"
        dispatcher.register_webhook(webhook_url)

        http_500_exc = urllib.error.HTTPError(
            url=webhook_url,
            code=500,
            msg="Internal Server Error: Backend Database Offline",
            hdrs=MagicMock(),
            fp=None,
        )

        with patch("urllib.request.urlopen", side_effect=http_500_exc) as mock_urlopen, \
             patch("dealflow_odoo.services.event_dispatcher.urllib.request.urlopen", side_effect=http_500_exc):
            try:
                # Execute update_order with discount modification
                res = integration_service.update_order(
                    sample_quotation.id,
                    {"note": "Webhook 500 stress test", "discount": 10.0, "dealflow_deal_id": "DEAL-500"},
                )

                assert mock_urlopen.called
                assert res["order_id"] == sample_quotation.id
            finally:
                dispatcher.clear()

        # Business operation succeeded
        assert sample_quotation.note == "Webhook 500 stress test"

        # Audit log verifies success
        logs = integration_service.get_audit_logs(limit=1)
        assert logs[0]["operation"] == "update_order"
        assert logs[0]["result"] == "SUCCESS"

    def test_webhook_connection_refused_network_error(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Webhook connection refused (URLError ConnectionRefusedError)."""
        dispatcher = integration_service.event_dispatcher
        dispatcher.register_webhook("http://127.0.0.1:9999/unreachable")

        conn_err = urllib.error.URLError(ConnectionRefusedError("Connection refused"))
        with patch("urllib.request.urlopen", side_effect=conn_err), \
             patch("dealflow_odoo.services.event_dispatcher.urllib.request.urlopen", side_effect=conn_err):
            try:
                res = integration_service.apply_approved_change(
                    sample_quotation.id,
                    {"dealflow_deal_id": "DEAL-REFUSED", "dealflow_approval_state": APPROVAL_STATE_APPROVED},
                )
                assert res["order_id"] == sample_quotation.id
            finally:
                dispatcher.clear()

    def test_exploding_event_listener_does_not_crash_business_op(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Event listener callback throws unhandled exception.

        Verify that an exploding listener error is trapped, other listeners still fire,
        and the commercial business operation completes successfully.
        """
        dispatcher = integration_service.event_dispatcher

        listener_a_invoked = False
        listener_b_invoked = False

        def exploding_listener(payload: EventPayloadDTO):
            nonlocal listener_a_invoked
            listener_a_invoked = True
            raise ZeroDivisionError("Fault Injection: ZeroDivisionError inside subscriber!")

        def healthy_listener(payload: EventPayloadDTO):
            nonlocal listener_b_invoked
            listener_b_invoked = True

        dispatcher.register_listener(EVENT_SALE_ORDER_CHANGED, exploding_listener)
        dispatcher.register_listener(EVENT_SALE_ORDER_CHANGED, healthy_listener)

        # Trigger update_order
        res = integration_service.update_order(
            sample_quotation.id,
            {"note": "Exploding listener test", "dealflow_deal_id": "DEAL-LISTEN-01"},
        )

        assert res["order_id"] == sample_quotation.id
        assert listener_a_invoked is True
        assert listener_b_invoked is True

        # Audit trail must show SUCCESS
        audit = integration_service.get_audit_logs(limit=1)[0]
        assert audit["operation"] == "update_order"
        assert audit["result"] == "SUCCESS"

    def test_multiple_wildcard_and_specific_exploding_listeners(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Both specific and wildcard listeners throw catastrophic errors."""
        dispatcher = integration_service.event_dispatcher

        def exploding_wildcard(payload: EventPayloadDTO):
            raise RuntimeError("Catastrophic error in wildcard listener")

        def exploding_specific(payload: EventPayloadDTO):
            raise TypeError("Catastrophic error in specific listener")

        survivor_called = []

        def survivor_listener(payload: EventPayloadDTO):
            survivor_called.append(payload.event_type)

        dispatcher.register_listener("*", exploding_wildcard)
        dispatcher.register_listener(EVENT_ORDER_APPROVED, exploding_specific)
        dispatcher.register_listener(EVENT_ORDER_APPROVED, survivor_listener)

        # Apply approved change
        res = integration_service.apply_approved_change(
            sample_quotation.id,
            {"dealflow_deal_id": "DEAL-SURVIVOR", "dealflow_approval_state": APPROVAL_STATE_APPROVED},
        )
        assert res["status"] == "approved_changes_applied"
        assert EVENT_ORDER_APPROVED in survivor_called


# =============================================================================
# TEST SUITE 2: AUDIT TRAIL COMPLETENESS & TAMPER RESISTANCE
# =============================================================================

class TestAuditTrailCompletenessAndTamperResistance:
    """Verifies audit trail completeness, structured failure recording, tamper defense,

    and bounded buffer retention across rapid successions of operations.
    """

    def test_audit_trail_10_distinct_operations_completeness(
        self,
        integration_service: OdooIntegrationService,
        mock_odoo_env: Any,
        seed_data: Dict[str, Any],
        sample_quotation: Any,
    ):
        """Execute 10 distinct operations in rapid succession.

        Verify EVERY single operation produces a structured audit log entry with:
        'operation', 'dealflow_deal_id', 'actor', 'timestamp', 'result'.
        """
        # 1. get_customer
        c = integration_service.get_customer(1)
        assert c.id == 1

        # 2. get_product
        p = integration_service.get_product(1)
        assert p.id == 1

        # 3. get_order
        o = integration_service.get_order(sample_quotation.id)
        assert o["id"] == sample_quotation.id

        # 4. get_deal_context
        ctx = integration_service.get_deal_context(sample_quotation.id)
        assert ctx.order_id == sample_quotation.id

        # 5. update_order
        u = integration_service.update_order(
            sample_quotation.id,
            {"note": "Rapid op 5", "dealflow_deal_id": "DEAL-RAPID-001"},
        )
        assert u["order_id"] == sample_quotation.id

        # 6. apply_approved_change
        a = integration_service.apply_approved_change(
            sample_quotation.id,
            {
                "dealflow_deal_id": "DEAL-RAPID-001",
                "dealflow_approval_state": APPROVAL_STATE_APPROVED,
                "lines": [{"id": 1, "discount": 10.0}],
            },
        )
        assert a["status"] == "approved_changes_applied"

        # 7. get_available_stock
        stock = integration_service.get_available_stock(1)
        assert stock >= 0.0

        # 8. get_warehouse_stock
        wh_stock = integration_service.get_warehouse_stock(1)
        assert isinstance(wh_stock, list)

        # 9. confirm_order
        valid_token = generate_approval_token(sample_quotation.id)
        conf = integration_service.confirm_order(sample_quotation.id, approval_token=valid_token)
        assert conf.get("confirmed") is True

        # 10. create_invoice
        inv = integration_service.create_invoice(sample_quotation.id)
        assert inv["invoice_id"] is not None

        # Inspect all audit logs recorded
        logs = integration_service.get_audit_logs(limit=50)
        assert len(logs) >= 10

        # Slice the 10 most recent logs (ordered newest to oldest)
        recent_10 = logs[:10]
        expected_operations = [
            "create_invoice",
            "confirm_order",
            "get_warehouse_stock",
            "get_available_stock",
            "apply_approved_change",
            "update_order",
            "get_deal_context",
            "get_order",
            "get_product",
            "get_customer",
        ]

        recorded_ops = [log["operation"] for log in recent_10]
        assert recorded_ops == expected_operations

        # Verify all mandatory audit fields for every operation
        for log in recent_10:
            assert "operation" in log and isinstance(log["operation"], str)
            assert "dealflow_deal_id" in log  # Must be present (can be str or None)
            assert "actor" in log and log["actor"] == "Test Admin"
            assert "timestamp" in log and isinstance(log["timestamp"], str)
            assert log["result"] == "SUCCESS"
            assert log["failure_reason"] is None
            assert isinstance(log["details"], dict)

        # Verify dealflow_deal_id was captured on deal-associated operations
        order_ops = [l for l in recent_10 if l["operation"] in ("confirm_order", "apply_approved_change", "update_order", "create_invoice")]
        for op_log in order_ops:
            assert op_log["dealflow_deal_id"] in ("DEAL-RAPID-001", "DEAL-ACME-001")

    def test_audit_trail_structured_failure_recording(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Execute operations designed to fail across different error domains.

        Verify that failed operations record result=FAILURE with structured failure_reason.
        """
        # Failure 1: NotFoundError on non-existent customer
        with pytest.raises(NotFoundError):
            integration_service.get_customer(99999)

        log1 = integration_service.get_audit_logs(limit=1)[0]
        assert log1["operation"] == "get_customer"
        assert log1["result"] == "FAILURE"
        assert "99999" in log1["failure_reason"]
        assert log1["details"].get("code") == "NOT_FOUND"

        # Failure 2: AuthorizationError on locked quotation confirm
        sample_quotation.dealflow_locked = True
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_PENDING
        with pytest.raises(AuthorizationError):
            integration_service.confirm_order(sample_quotation.id)  # No approval token

        log2 = integration_service.get_audit_logs(limit=1)[0]
        assert log2["operation"] == "confirm_order"
        assert log2["result"] == "FAILURE"
        assert "locked" in log2["failure_reason"].lower()
        assert log2["details"].get("code") == "AUTHORIZATION_ERROR"
        assert log2["dealflow_deal_id"] == sample_quotation.dealflow_deal_id

        # Failure 3: InvalidStateError on invoicing draft quotation
        draft_order = sample_quotation
        draft_order.state = "draft"
        with pytest.raises(InvalidStateError):
            integration_service.create_invoice(draft_order.id)

        log3 = integration_service.get_audit_logs(limit=1)[0]
        assert log3["operation"] == "create_invoice"
        assert log3["result"] == "FAILURE"
        assert "must be confirmed" in log3["failure_reason"].lower()
        assert log3["details"].get("code") == "INVALID_STATE"

        # Failure 4: IDOR AuthorizationError on negotiation submission
        with pytest.raises(AuthorizationError):
            integration_service.submit_negotiation(
                order_id=sample_quotation.id,
                customer_id=999,  # Unrelated/attacker customer
                proposed_changes={"requested_discount": 20.0},
            )

        log4 = integration_service.get_audit_logs(limit=1)[0]
        assert log4["operation"] == "submit_negotiation"
        assert log4["result"] == "FAILURE"
        assert "not authorized" in log4["failure_reason"].lower()
        assert log4["details"].get("code") == "AUTHORIZATION_ERROR"

    def test_audit_trail_tamper_resistance(
        self,
        integration_service: OdooIntegrationService,
    ):
        """Tamper Resistance: Mutating returned audit log entries does not corrupt internal state."""
        # Execute an operation to produce a log
        integration_service.get_customer(1)

        # Retrieve audit logs and attempt in-place tampering
        logs = integration_service.get_audit_logs(limit=5)
        first_entry = logs[0]
        original_result = first_entry["result"]
        assert original_result == "SUCCESS"

        # MALICIOUS TAMPERING ATTEMPT
        first_entry["result"] = "TAMPERED_BY_ATTACKER"
        first_entry["actor"] = "MALICIOUS_ACTOR"
        first_entry["details"]["tampered_key"] = "hacked"

        # Re-fetch audit logs from service
        fresh_logs = integration_service.get_audit_logs(limit=5)
        clean_entry = fresh_logs[0]

        # Verify internal logs are untouched
        assert clean_entry["result"] == "SUCCESS"
        assert clean_entry["actor"] != "MALICIOUS_ACTOR"
        assert "tampered_key" not in clean_entry["details"]

    def test_audit_trail_bounded_capacity_retention(
        self,
        mock_odoo_env: Any,
    ):
        """Buffer Retention: Overflows past 1000 entries drop oldest cleanly without leaks."""
        service = OdooIntegrationService(env=mock_odoo_env)

        # Artificially populate audit logs past limit (1000)
        for i in range(1050):
            service._log_audit(
                operation=f"stress_op_{i}",
                dealflow_deal_id=f"DEAL-{i}",
                record_id=i,
                actor="Stress Bot",
                timestamp=f"2026-09-05T10:00:{i%60:02d}Z",
                result="SUCCESS",
            )

        logs = service.get_audit_logs(limit=2000)
        assert len(logs) == 1000

        # Newest entry is stress_op_1049
        assert logs[0]["operation"] == "stress_op_1049"
        # Oldest retained entry is stress_op_50
        assert logs[-1]["operation"] == "stress_op_50"


# =============================================================================
# TEST SUITE 3: ERROR MAPPING CONSISTENCY & TRACEBACK CONTAINMENT
# =============================================================================

class TestErrorMappingConsistencyAndTracebackContainment:
    """Verifies that every Odoo-side exception and arbitrary Python error is mapped

    to the canonical DealFlowIntegrationError hierarchy, preventing raw traceback leaks.
    """

    def test_odoo_validation_error_mapped(self, integration_service: OdooIntegrationService):
        """Odoo ValidationError -> schemas.ValidationError (VALIDATION_ERROR)."""
        with patch.object(integration_service.env["res.partner"], "browse", side_effect=OdooValidationError("Odoo: Field is required")):
            with pytest.raises(ValidationError) as exc_info:
                integration_service.get_customer(1)
            assert exc_info.value.code == "VALIDATION_ERROR"
            assert "Field is required" in exc_info.value.message

    def test_odoo_access_error_mapped(self, integration_service: OdooIntegrationService):
        """Odoo AccessError / AccessDenied -> schemas.AuthorizationError (AUTHORIZATION_ERROR)."""
        with patch.object(integration_service.env["res.partner"], "browse", side_effect=OdooAccessError("Odoo: Access Denied")):
            with pytest.raises(AuthorizationError) as exc_info:
                integration_service.get_customer(1)
            assert exc_info.value.code == "AUTHORIZATION_ERROR"

        with patch.object(integration_service.env["res.partner"], "browse", side_effect=OdooAccessDenied("Odoo: Denied")):
            with pytest.raises(AuthorizationError) as exc_info:
                integration_service.get_customer(1)
            assert exc_info.value.code == "AUTHORIZATION_ERROR"

    def test_odoo_missing_error_mapped(self, integration_service: OdooIntegrationService):
        """Odoo MissingError -> schemas.NotFoundError (NOT_FOUND)."""
        with patch.object(integration_service.env["res.partner"], "browse", side_effect=OdooMissingError("Record missing")):
            with pytest.raises(NotFoundError) as exc_info:
                integration_service.get_customer(1)
            assert exc_info.value.code == "NOT_FOUND"

    def test_odoo_user_error_state_keywords_mapped_to_invalid_state(self, integration_service: OdooIntegrationService):
        """Odoo UserError containing state keywords -> schemas.InvalidStateError (INVALID_STATE)."""
        keywords = ["state", "status", "lock", "draft", "confirm", "approve", "cancel"]
        for kw in keywords:
            msg = f"Operation invalid in current order {kw}"
            with patch.object(integration_service.env["sale.order"], "browse", side_effect=OdooUserError(msg)):
                with pytest.raises(InvalidStateError) as exc_info:
                    integration_service.get_order(1)
                assert exc_info.value.code == "INVALID_STATE"
                assert msg in exc_info.value.message

    def test_odoo_user_error_generic_mapped_to_odoo_execution_error(self, integration_service: OdooIntegrationService):
        """Odoo UserError without state keywords -> schemas.OdooExecutionError (ODOO_FAILURE)."""
        with patch.object(integration_service.env["sale.order"], "browse", side_effect=OdooUserError("General fiscal error")):
            with pytest.raises(OdooExecutionError) as exc_info:
                integration_service.get_order(1)
            assert exc_info.value.code == "ODOO_FAILURE"

    def test_raw_unhandled_python_exceptions_never_escape(
        self,
        integration_service: OdooIntegrationService,
        sample_quotation: Any,
    ):
        """Fault Injection: Brutally inject raw Python exceptions into service dependencies.

        Verify that NO raw Python exceptions (KeyError, ZeroDivisionError, TypeError,
        RuntimeError, ConnectionResetError) escape through OdooIntegrationService.
        Every single one must be caught and wrapped in DealFlowIntegrationError.
        """
        nasty_exceptions = [
            KeyError("corrupted_column"),
            ZeroDivisionError("integer division or modulo by zero"),
            TypeError("unsupported operand type(s)"),
            RuntimeError("Critical kernel failure in adapter"),
            AttributeError("'NoneType' object has no attribute 'id'"),
            ConnectionResetError("Postgres server disconnected unexpectedly"),
            IndexError("list index out of range"),
        ]

        for nasty_exc in nasty_exceptions:
            # Attack get_customer
            with patch.object(integration_service.env["res.partner"], "browse", side_effect=nasty_exc):
                with pytest.raises(DealFlowIntegrationError) as exc_info:
                    integration_service.get_customer(1)
                assert isinstance(exc_info.value, OdooExecutionError)
                assert exc_info.value.code == "ODOO_FAILURE"

            # Attack get_product
            with patch.object(integration_service.env["product.product"], "browse", side_effect=nasty_exc):
                with pytest.raises(DealFlowIntegrationError) as exc_info:
                    integration_service.get_product(1)
                assert isinstance(exc_info.value, OdooExecutionError)

            # Attack get_available_stock
            with patch.object(integration_service.env["product.product"], "browse", side_effect=nasty_exc):
                with pytest.raises(DealFlowIntegrationError) as exc_info:
                    integration_service.get_available_stock(1)
                assert isinstance(exc_info.value, OdooExecutionError)

            # Attack confirm_order
            with patch.object(integration_service.env["sale.order"], "browse", side_effect=nasty_exc):
                with pytest.raises(DealFlowIntegrationError) as exc_info:
                    integration_service.confirm_order(sample_quotation.id)
                assert isinstance(exc_info.value, OdooExecutionError)

    def test_api_controller_error_responses_and_http_status(
        self,
        mock_api_request_context: Any,
        sample_quotation: Any,
    ):
        """Attack DealFlowApiController REST endpoints with injected domain errors.

        Verify correct HTTP status codes and structured response payloads without traceback leak.
        """
        controller = DealFlowApiController()

        # Mock service raising each error type
        mock_service = MagicMock(spec=OdooIntegrationService)
        DealFlowApiController.set_service_override(mock_service)

        test_cases = [
            (ValidationError("Discount out of range"), 400, "VALIDATION_ERROR"),
            (AuthorizationError("Token expired"), 403, "AUTHORIZATION_ERROR"),
            (NotFoundError("Quotation not found"), 404, "NOT_FOUND"),
            (InvalidStateError("Cannot confirm locked quotation"), 409, "INVALID_STATE"),
            (OdooExecutionError("Database deadlock"), 500, "ODOO_FAILURE"),
            (RuntimeError("Unexpected unhandled engine exception"), 500, "INTERNAL_SERVER_ERROR"),
        ]

        for raised_exc, expected_status, expected_code in test_cases:
            mock_service.get_deal_context.side_effect = raised_exc
            mock_api_request_context(data={})

            resp = controller.order_context(sample_quotation.id)
            assert resp.status_code == expected_status

            body = json.loads(resp.get_data(as_text=True))
            assert body["success"] is False
            assert "error" in body
            assert body["error"]["code"] == expected_code
            assert "message" in body["error"]


# =============================================================================
# TEST SUITE 4: CONCURRENCY & HIGH THROUGHPUT
# =============================================================================

class TestConcurrencyAndHighThroughput:
    """Stress tests EventDispatcher and OdooIntegrationService under multithreaded

    concurrency, rapid buffer eviction, and high event throughput.
    """

    def test_rapid_dispatch_100_events_and_buffer_retrieval(self):
        """Rapidly dispatch 100 sequential events and verify FIFO buffer and retrieval order."""
        dispatcher = EventDispatcher(max_history=100)

        for i in range(100):
            dispatcher.dispatch(
                event_type="rapid.test.event",
                record_id=i,
                model="test.model",
                data={"sequence": i, "data": f"payload_{i}"},
                deal_id=f"DEAL-{i:03d}",
            )

        events = dispatcher.get_recent_events(limit=100)
        assert len(events) == 100

        # Ordered newest to oldest
        assert events[0]["data"]["sequence"] == 99
        assert events[0]["dealflow_deal_id"] == "DEAL-099"
        assert events[-1]["data"]["sequence"] == 0
        assert events[-1]["dealflow_deal_id"] == "DEAL-000"

    def test_concurrent_multithreaded_dispatch_100_events(self):
        """Concurrency: 10 worker threads dispatching 10 events each (100 total),

        while concurrent reader threads poll get_recent_events and listener changer mutates callbacks.
        Verify zero race conditions, zero dropped events, and zero thread exceptions.
        """
        dispatcher = EventDispatcher(max_history=500)
        worker_errors: List[Exception] = []
        reader_errors: List[Exception] = []
        stop_readers = False

        # Reader worker
        def reader_worker():
            while not stop_readers:
                try:
                    evs = dispatcher.get_recent_events(limit=25)
                    assert len(evs) <= 25
                    time.sleep(0.001)
                except Exception as e:
                    reader_errors.append(e)

        # Dispatcher worker
        def dispatch_worker(worker_id: int):
            for i in range(10):
                try:
                    dispatcher.dispatch(
                        event_type="concurrent.event",
                        record_id=worker_id * 100 + i,
                        model="concurrent.model",
                        data={"worker": worker_id, "index": i},
                        deal_id=f"DEAL-W{worker_id}-{i}",
                    )
                except Exception as e:
                    worker_errors.append(e)

        # Listener mutator
        def listener_mutator():
            cb = lambda p: None
            while not stop_readers:
                dispatcher.register_listener("concurrent.event", cb)
                dispatcher.unregister_listener("concurrent.event", cb)
                time.sleep(0.002)

        # Launch readers & listener mutator
        reader_threads = [threading.Thread(target=reader_worker) for _ in range(4)]
        mutator_thread = threading.Thread(target=listener_mutator)

        for r in reader_threads:
            r.start()
        mutator_thread.start()

        # Launch 10 concurrent dispatchers
        dispatch_threads = [threading.Thread(target=dispatch_worker, args=(w,)) for w in range(10)]
        for d in dispatch_threads:
            d.start()

        for d in dispatch_threads:
            d.join()

        # Stop background readers
        stop_readers = True
        for r in reader_threads:
            r.join()
        mutator_thread.join()

        assert len(worker_errors) == 0, f"Worker errors: {worker_errors}"
        assert len(reader_errors) == 0, f"Reader errors: {reader_errors}"

        # Verify all 100 events were recorded safely
        all_events = dispatcher.get_recent_events(limit=500)
        assert len(all_events) == 100

        # Verify all 10 workers produced 10 events each
        worker_counts = {}
        for ev in all_events:
            w_id = ev["data"]["worker"]
            worker_counts[w_id] = worker_counts.get(w_id, 0) + 1

        assert len(worker_counts) == 10
        for w_id in range(10):
            assert worker_counts[w_id] == 10

    def test_event_dispatcher_buffer_capacity_eviction(self):
        """Buffer Eviction: Dispatch 150 events to buffer with max_history=50.

        Verify buffer holds exactly the 50 newest events (#100 to #149) in reverse order.
        """
        dispatcher = EventDispatcher(max_history=50)

        for i in range(150):
            dispatcher.dispatch(
                event_type="buffer.test",
                record_id=i,
                model="test.model",
                data={"seq": i},
            )

        events = dispatcher.get_recent_events(limit=100)
        assert len(events) == 50

        # Newest should be seq=149, oldest retained should be seq=100
        assert events[0]["data"]["seq"] == 149
        assert events[-1]["data"]["seq"] == 100

        # Evicted elements (0-99) must not exist in buffer
        retained_seqs = [e["data"]["seq"] for e in events]
        for evicted in range(100):
            assert evicted not in retained_seqs

    def test_event_buffer_tamper_resistance(self):
        """Tamper Resistance: Mutating returned event dicts does not corrupt event history."""
        dispatcher = EventDispatcher(max_history=10)
        dispatcher.dispatch(
            event_type="security.test",
            record_id=42,
            model="sale.order",
            data={"original_key": "safe_value"},
        )

        events = dispatcher.get_recent_events(limit=5)
        ev = events[0]
        ev["data"]["original_key"] = "COMPROMISED_VALUE"
        ev["data"]["injected_exploit"] = True

        fresh_events = dispatcher.get_recent_events(limit=5)
        clean_ev = fresh_events[0]

        assert clean_ev["data"]["original_key"] == "safe_value"
        assert "injected_exploit" not in clean_ev["data"]

    def test_concurrent_audit_logging_thread_safety(self, mock_odoo_env: Any):
        """Audit Log Concurrency: 10 threads logging 20 audit entries each (200 total)

        while concurrent reader threads continuously call get_audit_logs().
        """
        service = OdooIntegrationService(env=mock_odoo_env)
        errors: List[Exception] = []
        stop_readers = False

        def reader():
            while not stop_readers:
                try:
                    logs = service.get_audit_logs(limit=30)
                    assert len(logs) <= 30
                    time.sleep(0.001)
                except Exception as e:
                    errors.append(e)

        def logger_worker(worker_id: int):
            for i in range(20):
                try:
                    service._log_audit(
                        operation=f"worker_op_{worker_id}",
                        dealflow_deal_id=f"DEAL-W{worker_id}",
                        record_id=i,
                        actor=f"Worker {worker_id}",
                        timestamp=f"2026-09-05T10:00:00Z",
                        result="SUCCESS",
                    )
                except Exception as e:
                    errors.append(e)

        readers = [threading.Thread(target=reader) for _ in range(3)]
        for r in readers:
            r.start()

        workers = [threading.Thread(target=logger_worker, args=(w,)) for w in range(10)]
        for w in workers:
            w.start()

        for w in workers:
            w.join()

        stop_readers = True
        for r in readers:
            r.join()

        assert len(errors) == 0, f"Encountered audit errors: {errors}"
        all_logs = service.get_audit_logs(limit=500)
        assert len(all_logs) == 200
