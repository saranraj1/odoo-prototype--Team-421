"""Shared pytest fixtures for governance engine tests."""

import sys
from pathlib import Path
import pytest

# Ensure backend/app is in python path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.governance.context import DealContext, DealLineContext, CustomerContext, DealTotals
from app.governance.policy.models import DiscountPolicy


@pytest.fixture
def sample_gold_deal() -> DealContext:
    """Standard demo deal: Acme Corp (Gold Tier) with 10 Laptops and 1 Setup Service."""
    return DealContext(
        deal_id="d7b9c1e0-8a2b-4c5d-9e6f-1a2b3c4d5e6f",
        odoo_sale_order_id=1024,
        order_name="SO001024",
        customer=CustomerContext(
            odoo_partner_id=58,
            name="Acme Corporation",
            tier="Gold",
            email="procurement@acme.com"
        ),
        lines=[
            DealLineContext(
                odoo_line_id=201,
                odoo_product_id=72,
                product_name="Enterprise Laptop Pro",
                category_name="Hardware",
                odoo_category_id=8,
                quantity=10.0,
                price_unit=50000.0,
                cost_unit=38000.0,
                discount_pct=12.0,  # Below Gold (15%) and Hardware (15%) -> Compliant
            ),
            DealLineContext(
                odoo_line_id=202,
                odoo_product_id=85,
                product_name="Architecture Setup Service",
                category_name="Services",
                odoo_category_id=12,
                quantity=1.0,
                price_unit=100000.0,
                cost_unit=70000.0,
                discount_pct=18.0,  # Below Gold (15%) BUT above Services (10%) -> 8% VIOLATION!
            )
        ],
        status="DRAFT",
        approval_state="DRAFT",
        stalled_days=1
    )
    deal.recalculate_totals()
    return deal


@pytest.fixture
def sample_compliant_deal() -> DealContext:
    """Fully compliant quote with 0 policy violations."""
    deal = DealContext(
        deal_id="c1a2b3c4-0000-1111-2222-333344445555",
        odoo_sale_order_id=1025,
        order_name="SO001025",
        customer=CustomerContext(
            odoo_partner_id=99,
            name="TechCorp",
            tier="Silver"  # Silver limit = 10%
        ),
        lines=[
            DealLineContext(
                odoo_line_id=301,
                odoo_product_id=72,
                product_name="Enterprise Laptop Pro",
                category_name="Hardware",
                odoo_category_id=8,
                quantity=5.0,
                price_unit=50000.0,
                cost_unit=35000.0,
                discount_pct=8.0,  # 8% <= 10% -> Compliant
            )
        ],
        status="DRAFT",
        approval_state="DRAFT",
        stalled_days=1
    )
    deal.recalculate_totals()
    return deal
