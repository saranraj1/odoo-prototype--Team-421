"""Governance Interfaces and Protocols.

Defines dependency-injection contracts for Database and Odoo adapters.
Enables full unit-testing without external services.
"""

from typing import Protocol, List, Optional, Dict, Any
from pydantic import BaseModel


class WarehouseStock(BaseModel):
    """Warehouse inventory balance."""
    odoo_warehouse_id: int
    warehouse_name: str
    quantity_available: float
    is_primary: bool = False
    shipping_cost_unit: float = 100.0


class RecommendationCandidate(BaseModel):
    """Product candidate for upsell / cross-sell."""
    odoo_product_id: int
    product_name: str
    category_name: str
    price_unit: float
    cost_unit: float
    co_purchase_rate: float = 0.0  # 0.0 - 1.0
    promotion_weight: float = 0.0  # 0.0 - 1.0
    reason_template: str = ""


class PolicyProviderProtocol(Protocol):
    """Provider for active discount policies."""
    def get_active_policies(self, company_id: Optional[int] = None) -> List[Any]:
        ...


class InventoryProviderProtocol(Protocol):
    """Provider for real-time stock levels."""
    def get_stock_for_products(self, product_ids: List[int]) -> Dict[int, List[WarehouseStock]]:
        ...


class RecommendationProviderProtocol(Protocol):
    """Provider for co-purchase and candidate product data."""
    def get_candidates_for_lines(self, line_product_ids: List[int]) -> List[RecommendationCandidate]:
        ...


class AuditLoggerProtocol(Protocol):
    """Logger for immutable governance audit events."""
    def log_event(
        self,
        deal_id: str,
        event_type: str,
        actor_type: str,
        actor_id: str,
        before_state: Optional[Dict[str, Any]],
        after_state: Optional[Dict[str, Any]],
        reason: str,
    ) -> None:
        ...


class MockPolicyProvider:
    """Mock policy provider returning seeded discount policies."""

    def __init__(self, policies: Optional[List[Any]] = None):
        self.policies = policies or []

    def get_active_policies(self, company_id: Optional[int] = None) -> List[Any]:
        return self.policies


# In-Memory Default Implementations for Standalone / Mock Operation
class InMemoryAuditLogger:
    """Mock audit logger recording events in memory."""

    def __init__(self):
        self.events: List[Dict[str, Any]] = []

    def log_event(
        self,
        deal_id: str,
        event_type: str,
        actor_type: str,
        actor_id: str,
        before_state: Optional[Dict[str, Any]],
        after_state: Optional[Dict[str, Any]],
        reason: str,
    ) -> None:
        self.events.append({
            "deal_id": deal_id,
            "event_type": event_type,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "before_state": before_state,
            "after_state": after_state,
            "reason": reason,
        })


class MockInventoryProvider:
    """Mock inventory provider returning seeded warehouse stock for demo."""

    def __init__(self, stock_map: Optional[Dict[int, List[WarehouseStock]]] = None):
        self.stock_map = stock_map or {
            72: [  # Enterprise Laptop Pro (Product 72)
                WarehouseStock(
                    odoo_warehouse_id=1,
                    warehouse_name="Main Warehouse",
                    quantity_available=9.0,
                    is_primary=True,
                    shipping_cost_unit=500.0,
                ),
                WarehouseStock(
                    odoo_warehouse_id=2,
                    warehouse_name="East Depot",
                    quantity_available=6.0,
                    is_primary=False,
                    shipping_cost_unit=750.0,
                ),
            ]
        }

    def get_stock_for_products(self, product_ids: List[int]) -> Dict[int, List[WarehouseStock]]:
        return {pid: self.stock_map.get(pid, []) for pid in product_ids}


class MockRecommendationProvider:
    """Mock recommendation provider for demo products."""

    def __init__(self):
        self.catalog = [
            RecommendationCandidate(
                odoo_product_id=99,
                product_name="Thunderbolt Docking Station",
                category_name="Hardware",
                price_unit=25000.0,
                cost_unit=12000.0,
                co_purchase_rate=0.68,
                promotion_weight=0.10,
                reason_template="68% of laptop deals include docking stations; projected margin increases by ₹13,000.",
            ),
            RecommendationCandidate(
                odoo_product_id=105,
                product_name="2-Year Extended Support Plan",
                category_name="Services",
                price_unit=40000.0,
                cost_unit=15000.0,
                co_purchase_rate=0.45,
                promotion_weight=0.20,
                reason_template="High margin add-on frequently paired with enterprise hardware.",
            ),
        ]

    def get_candidates_for_lines(self, line_product_ids: List[int]) -> List[RecommendationCandidate]:
        # Return products not already in the quote
        return [p for p in self.catalog if p.odoo_product_id not in line_product_ids]
