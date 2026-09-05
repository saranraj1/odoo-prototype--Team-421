"""DealFlow360 Odoo Integration — Event Dispatcher & Webhook Service.

This module handles event emission, subscriber callbacks, in-memory event audit
history, and HTTP webhook notifications to DealFlow backend and external consumers.
"""

from __future__ import annotations

import copy
import json
import logging
import os
import threading
import urllib.error
import urllib.request
from collections import deque
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from dealflow_odoo.constants import (
    EVENT_CUSTOMER_NEGOTIATION_SUBMITTED,
    EVENT_DISCOUNT_CHANGED,
    EVENT_INVOICE_CREATED,
    EVENT_ORDER_APPROVED,
    EVENT_ORDER_CONFIRMED,
    EVENT_PAYMENT_RECORDED,
    EVENT_SALE_ORDER_CHANGED,
    EVENT_SALE_ORDER_CREATED,
    EVENT_SALE_ORDER_LINE_CHANGED,
    EVENT_STOCK_CHANGED,
)
from dealflow_odoo.schemas import EventPayloadDTO

logger = logging.getLogger("dealflow.event_dispatcher")


class EventDispatcher:
    """Dispatches lifecycle events and notifies DealFlow backend via listeners and webhooks."""

    def __init__(
        self,
        webhook_urls: Optional[List[str]] = None,
        max_history: int = 1000,
    ) -> None:
        """Initialize event dispatcher with listeners, webhooks, and history buffer.

        Args:
            webhook_urls: Optional list of webhook endpoint URLs.
            max_history: Maximum number of recent events kept in memory.
        """
        self._lock = threading.Lock()
        self._listeners: Dict[str, List[Callable[[EventPayloadDTO], Any]]] = {}
        self._webhook_urls: List[str] = list(webhook_urls or [])
        env_webhook = os.environ.get("DEALFLOW_WEBHOOK_URL")
        if env_webhook and env_webhook not in self._webhook_urls:
            self._webhook_urls.append(env_webhook)

        self._max_history = max_history
        self._recent_events: deque[Dict[str, Any]] = deque(maxlen=max_history)

    def register_listener(
        self,
        event_type: str,
        callback: Callable[[EventPayloadDTO], Any],
    ) -> None:
        """Register a callback function for a specific event type or '*' for all.

        Args:
            event_type: Event name or '*' for wildcard matching.
            callback: Callable receiving EventPayloadDTO.
        """
        with self._lock:
            if event_type not in self._listeners:
                self._listeners[event_type] = []
            if callback not in self._listeners[event_type]:
                self._listeners[event_type].append(callback)
                logger.debug(
                    "Registered listener %s for event_type '%s'",
                    getattr(callback, "__name__", str(callback)),
                    event_type,
                )

    def unregister_listener(
        self,
        event_type: str,
        callback: Callable[[EventPayloadDTO], Any],
    ) -> bool:
        """Unregister a callback function for an event type.

        Args:
            event_type: The event type.
            callback: The callback to remove.

        Returns:
            True if removed, False if not found.
        """
        with self._lock:
            if event_type in self._listeners and callback in self._listeners[event_type]:
                self._listeners[event_type].remove(callback)
                return True
            return False

    def register_webhook(self, url: str) -> None:
        """Register a webhook endpoint URL.

        Args:
            url: Destination URL for event payloads (e.g. POST /internal/events/odoo).
        """
        with self._lock:
            if url not in self._webhook_urls:
                self._webhook_urls.append(url)
                logger.info("Registered webhook endpoint: %s", url)

    def unregister_webhook(self, url: str) -> bool:
        """Unregister a webhook endpoint URL.

        Args:
            url: Webhook URL to remove.

        Returns:
            True if removed, False if not found.
        """
        with self._lock:
            if url in self._webhook_urls:
                self._webhook_urls.remove(url)
                logger.info("Unregistered webhook endpoint: %s", url)
                return True
            return False

    def clear(self) -> None:
        """Clear all registered listeners, webhook URLs, and recent events history."""
        with self._lock:
            self._listeners.clear()
            self._webhook_urls.clear()
            self._recent_events.clear()

    def dispatch(
        self,
        event_type: str,
        record_id: int,
        model: str,
        data: Dict[str, Any],
        deal_id: Optional[str] = None,
        actor_id: Optional[int] = None,
    ) -> EventPayloadDTO:
        """Construct, record, and dispatch an event to listeners and webhooks.

        Args:
            event_type: The type/topic of event (e.g. EVENT_ORDER_CONFIRMED).
            record_id: The ID of the database record.
            model: The Odoo model name (e.g. 'sale.order').
            data: Arbitrary event payload details.
            deal_id: Optional DealFlow deal identifier.
            actor_id: Optional ID of the user triggering the action.

        Returns:
            The generated EventPayloadDTO.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        payload = EventPayloadDTO(
            event_type=event_type,
            timestamp=timestamp,
            actor_id=actor_id,
            record_id=record_id,
            model=model,
            data=data,
            dealflow_deal_id=deal_id,
        )

        event_dict = asdict(payload)
        with self._lock:
            self._recent_events.append(event_dict)

        logger.info(
            "Event dispatched: event_type=%s, model=%s, record_id=%d, deal_id=%s, actor_id=%s",
            event_type,
            model,
            record_id,
            deal_id,
            actor_id,
            extra={
                "event_type": event_type,
                "model": model,
                "record_id": record_id,
                "dealflow_deal_id": deal_id,
                "actor_id": actor_id,
            },
        )

        # 1. Trigger local registered listeners
        self._invoke_listeners(payload)

        # 2. Notify remote webhooks
        self.notify_dealflow(payload)

        return payload

    def notify_dealflow(self, payload: EventPayloadDTO) -> bool:
        """Send webhook notifications to all registered endpoints.

        Args:
            payload: EventPayloadDTO to serialize and send.

        Returns:
            True if all active endpoints succeeded or if no webhooks configured;
            False if any delivery failed.
        """
        with self._lock:
            urls = list(self._webhook_urls)

        if not urls:
            return True

        payload_dict = asdict(payload)
        raw_body = json.dumps(payload_dict, default=str).encode("utf-8")
        all_success = True

        for url in urls:
            req = urllib.request.Request(
                url=url,
                data=raw_body,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "DealFlow-Odoo-Integration/1.0",
                    "X-DealFlow-Event": payload.event_type,
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    status_code = resp.getcode()
                    if 200 <= status_code < 300:
                        logger.debug(
                            "Webhook delivered successfully to %s for %s",
                            url,
                            payload.event_type,
                        )
                    else:
                        logger.warning(
                            "Webhook returned non-2xx status code %d from %s",
                            status_code,
                            url,
                        )
                        all_success = False
            except urllib.error.HTTPError as http_err:
                logger.warning(
                    "HTTP error %d delivering webhook to %s: %s",
                    http_err.code,
                    url,
                    http_err.reason,
                )
                all_success = False
            except urllib.error.URLError as url_err:
                logger.warning(
                    "Network error delivering webhook to %s: %s",
                    url,
                    url_err.reason,
                )
                all_success = False
            except Exception as exc:
                logger.error(
                    "Unexpected error delivering webhook to %s: %s",
                    url,
                    exc,
                )
                all_success = False

        return all_success

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent events in reverse chronological order.

        Args:
            limit: Maximum number of events to return (default 50).

        Returns:
            List of event dictionaries ordered from newest to oldest.
        """
        with self._lock:
            events = [copy.deepcopy(e) for e in reversed(self._recent_events)]
            return events[:limit]

    def clear(self) -> None:
        """Clear all registered listeners, webhooks, and event history."""
        with self._lock:
            self._listeners.clear()
            self._webhook_urls.clear()
            self._recent_events.clear()

    def _invoke_listeners(self, payload: EventPayloadDTO) -> None:
        """Invoke all matching callbacks for the given payload."""
        callbacks: List[Callable[[EventPayloadDTO], Any]] = []

        with self._lock:
            if payload.event_type in self._listeners:
                callbacks.extend(self._listeners[payload.event_type])

            if "*" in self._listeners:
                callbacks.extend(self._listeners["*"])

        for callback in callbacks:
            try:
                callback(payload)
            except Exception as exc:
                logger.error(
                    "Error executing listener %s for event %s: %s",
                    getattr(callback, "__name__", str(callback)),
                    payload.event_type,
                    exc,
                    exc_info=True,
                )


_GLOBAL_EVENT_DISPATCHER: Optional[EventDispatcher] = None


def get_event_dispatcher() -> EventDispatcher:
    """Retrieve or initialize the global singleton EventDispatcher instance."""
    global _GLOBAL_EVENT_DISPATCHER
    if _GLOBAL_EVENT_DISPATCHER is None:
        _GLOBAL_EVENT_DISPATCHER = EventDispatcher()
    return _GLOBAL_EVENT_DISPATCHER
