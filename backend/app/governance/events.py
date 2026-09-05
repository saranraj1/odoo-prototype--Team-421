"""Event Bus and Idempotent Governance Event Handling.

Ensures duplicate events (e.g. repeated DISCOUNT_CHANGED or CUSTOMER_NEGOTIATED)
do not trigger duplicate approval requests or duplicate side-effects.
"""

from enum import Enum
from typing import Dict, Any, Optional, Set, Callable
from pydantic import BaseModel, Field


class EventType(str, Enum):
    DEAL_CREATED = "DEAL_CREATED"
    DEAL_UPDATED = "DEAL_UPDATED"
    DISCOUNT_CHANGED = "DISCOUNT_CHANGED"
    LINE_ADDED = "LINE_ADDED"
    LINE_REMOVED = "LINE_REMOVED"
    QUANTITY_CHANGED = "QUANTITY_CHANGED"
    CUSTOMER_NEGOTIATED = "CUSTOMER_NEGOTIATED"
    APPROVAL_SUBMITTED = "APPROVAL_SUBMITTED"
    APPROVAL_APPROVED = "APPROVAL_APPROVED"
    APPROVAL_REJECTED = "APPROVAL_REJECTED"
    APPROVAL_COMPLETED = "APPROVAL_COMPLETED"
    APPROVAL_INVALIDATED = "APPROVAL_INVALIDATED"
    STOCK_CHANGED = "STOCK_CHANGED"
    FULFILLMENT_CHANGED = "FULFILLMENT_CHANGED"
    ORDER_CONFIRMED = "ORDER_CONFIRMED"


class GovernanceEvent(BaseModel):
    """Event emitted across DealFlow governance lifecycle."""
    event_id: str
    event_type: EventType
    deal_id: str
    actor_type: str = Field(default="USER", description="USER, SYSTEM, CUSTOMER")
    actor_id: str = "system"
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[str] = None


class GovernanceEventBus:
    """In-memory event bus with deterministic idempotency controls."""

    def __init__(self):
        self._processed_event_ids: Set[str] = set()
        self._handlers: Dict[EventType, list[Callable[[GovernanceEvent], Any]]] = {}

    def is_processed(self, event_id: str) -> bool:
        """Check whether this event ID has already been executed."""
        return event_id in self._processed_event_ids

    def mark_processed(self, event_id: str) -> None:
        """Mark an event ID as completed."""
        self._processed_event_ids.add(event_id)

    def subscribe(self, event_type: EventType, handler: Callable[[GovernanceEvent], Any]) -> None:
        """Register a handler for a governance event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def publish(self, event: GovernanceEvent) -> bool:
        """Publish an event with idempotency check. Returns True if processed, False if duplicate."""
        if self.is_processed(event.event_id):
            return False  # Idempotently ignored duplicate event

        handlers = self._handlers.get(event.event_type, [])
        for handler in handlers:
            handler(event)

        self.mark_processed(event.event_id)
        return True
