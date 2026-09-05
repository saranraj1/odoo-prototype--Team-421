"""DealFlow360 - Deal Governance Engine (Agent 3 Domain).

"Odoo owns transactions; DealFlow owns decisions; Deal Guardian governs deal state."
"""

from .context import DealContext, DealLineContext, CustomerContext, DealTotals
from .guardian import DealGuardian, GuardianEvaluationResult, NextBestAction
from .events import GovernanceEventBus, GovernanceEvent, EventType

__all__ = [
    "DealContext",
    "DealLineContext",
    "CustomerContext",
    "DealTotals",
    "DealGuardian",
    "GuardianEvaluationResult",
    "NextBestAction",
    "GovernanceEventBus",
    "GovernanceEvent",
    "EventType",
]
