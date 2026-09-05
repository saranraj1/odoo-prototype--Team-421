"""Test Governance Event Bus and Idempotency Controls."""

from app.governance.events import GovernanceEventBus, GovernanceEvent, EventType


def test_event_bus_publishing_and_handling():
    bus = GovernanceEventBus()
    handled_events = []

    def handler(evt: GovernanceEvent):
        handled_events.append(evt)

    bus.subscribe(EventType.CUSTOMER_NEGOTIATED, handler)

    event = GovernanceEvent(
        event_id="evt_neg_001",
        event_type=EventType.CUSTOMER_NEGOTIATED,
        deal_id="deal_test_1",
        payload={"discount": 22.0}
    )

    published = bus.publish(event)
    assert published is True
    assert len(handled_events) == 1
    assert handled_events[0].event_id == "evt_neg_001"


def test_event_bus_idempotency_ignores_duplicates():
    bus = GovernanceEventBus()
    invocations = []

    def on_invalidation(evt: GovernanceEvent):
        invocations.append(evt.event_id)

    bus.subscribe(EventType.APPROVAL_INVALIDATED, on_invalidation)

    event = GovernanceEvent(
        event_id="evt_inv_999",
        event_type=EventType.APPROVAL_INVALIDATED,
        deal_id="deal_test_2",
        payload={"reason": "Discount increased to 22%"}
    )

    # First delivery: processed
    first_res = bus.publish(event)
    assert first_res is True
    assert len(invocations) == 1

    # Second delivery with identical event_id: idempotently ignored
    second_res = bus.publish(event)
    assert second_res is False
    assert len(invocations) == 1  # No duplicate execution!
