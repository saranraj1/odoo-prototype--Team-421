# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Sales & Transaction Integration Test Suite.

Verifies:
- Customer master data retrieval and CustomerDTO mapping
- Product catalog querying, pricing, and recurring revenue attributes
- Order serialization and line-item breakdowns
- DealContextDTO generation for DealFlow Deal Guardian
- Margin calculations, cost tracking, and blended discount computation
- Governance guards: confirmation blocking when locked or exceeding policy threshold
- Atomic approved changes application and state unlock
- Tamper detection: reapproval requirement when approved orders are altered
"""

from __future__ import annotations

import pytest

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    DEFAULT_MAX_REP_DISCOUNT,
    HEALTH_STATUS_HEALTHY,
)
from dealflow_odoo.schemas import (
    AuthorizationError,
    CustomerDTO,
    DealContextDTO,
    InvalidStateError,
    NotFoundError,
    ValidationError,
)


class TestSalesTransaction:
    """Test suite for SalesAdapter and sale.order DealFlow governance."""

    def test_get_customer_success_and_validation(self, sales_adapter):
        """Tests reading customer profile and validation error handling."""
        # Valid customer (Acme Corp)
        customer = sales_adapter.get_customer(1)
        assert isinstance(customer, CustomerDTO)
        assert customer.id == 1
        assert customer.name == "Acme Corp"
        assert customer.email == "contact@acme.example.com"
        assert customer.credit_limit == 50000.0
        assert customer.total_invoiced == 12000.0
        assert customer.is_company is True

        # Non-existent customer
        with pytest.raises(NotFoundError):
            sales_adapter.get_customer(9999)

        # Invalid partner_id parameter
        with pytest.raises(ValidationError):
            sales_adapter.get_customer(-5)
        with pytest.raises(ValidationError):
            sales_adapter.get_customer("invalid_id")  # type: ignore

    def test_get_product_pricing_and_recurring_attributes(self, sales_adapter):
        """Tests reading product catalog with one-time vs recurring classification."""
        # 1. One-time hardware: Laptop
        laptop = sales_adapter.get_product(1)
        assert laptop.id == 1
        assert laptop.name == "Laptop"
        assert laptop.list_price == 1200.0
        assert laptop.standard_price == 800.0
        assert laptop.category_name == "Hardware"
        assert laptop.is_recurring is False
        assert laptop.recurring_interval is None

        # 2. Recurring service: Premium Support
        support = sales_adapter.get_product(5)
        assert support.id == 5
        assert support.name == "Premium Support"
        assert support.list_price == 500.0
        assert support.standard_price == 250.0
        assert support.is_recurring is True
        assert support.recurring_interval == "month"

        # Non-existent product
        with pytest.raises(NotFoundError):
            sales_adapter.get_product(8888)

    def test_get_order_raw_serialization(self, sales_adapter, sample_quotation):
        """Tests get_order returning complete order dictionary with lines and DealFlow governance fields."""
        order_dict = sales_adapter.get_order(sample_quotation.id)
        assert order_dict["id"] == sample_quotation.id
        assert order_dict["name"] == "SO0001"
        assert order_dict["state"] == "draft"
        assert order_dict["partner_id"] == 1
        assert order_dict["dealflow_deal_id"] == "DEAL-ACME-001"
        assert len(order_dict["lines"]) == 2

        line1 = order_dict["lines"][0]
        assert line1["product_name"] == "Laptop"
        assert line1["price_unit"] == 1200.0
        assert line1["discount"] == 0.0

    def test_get_deal_context_comprehensive_formatting(self, sales_adapter, sample_quotation):
        """Tests get_deal_context assembling the complete DealContextDTO for Deal Guardian."""
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        assert isinstance(ctx, DealContextDTO)
        assert ctx.order_id == sample_quotation.id
        assert ctx.order_name == "SO0001"
        assert ctx.deal_id == "DEAL-ACME-001"

        # Customer summary
        assert ctx.customer.name == "Acme Corp"
        assert ctx.customer.credit_limit == 50000.0

        # Totals and Financials
        # Laptop ($1200, cost $800) + Premium Support ($500, cost $250)
        assert ctx.amount_untaxed == 1700.0
        assert ctx.total_cost == 1050.0
        assert ctx.total_margin == 650.0
        expected_margin_pct = round((650.0 / 1700.0) * 100.0, 2)
        assert ctx.margin_percent == expected_margin_pct
        assert ctx.blended_discount == 0.0

        # Recurring / Subscription metrics
        assert ctx.has_recurring_lines is True
        assert ctx.mrr == 500.0
        assert ctx.arr == 6000.0

        # Line items
        assert len(ctx.lines) == 2
        line1, line2 = ctx.lines[0], ctx.lines[1]
        assert line1.product_name == "Laptop"
        assert line1.margin == 400.0
        assert line1.margin_percent == round((400.0 / 1200.0) * 100.0, 2)
        assert line1.is_recurring is False

        assert line2.product_name == "Premium Support"
        assert line2.margin == 250.0
        assert line2.is_recurring is True
        assert line2.recurring_interval == "month"

    def test_discount_update_and_margin_recalculation(self, sales_adapter, sample_quotation):
        """Tests applying a discount to a line item, updating margins, and triggering governance lock."""
        # Apply 18% discount to line 2 (Premium Support: unit 500 -> subtotal 410)
        terms = {
            "target_line_discounts": {2: 18.0},
            "customer_note": "Customer requested 18% discount for volume commitment",
        }
        res = sales_adapter.update_negotiated_terms(sample_quotation.id, terms)
        assert res["success"] is True
        assert res["dealflow_approval_state"] == APPROVAL_STATE_PENDING
        assert res["dealflow_locked"] is True

        # Check refreshed deal context
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        # Line 2: 500 * (1 - 0.18) = 410. Margin = 410 - 250 = 160
        # Line 1: 1200. Margin = 400
        # Total untaxed = 1610. Total cost = 1050. Total margin = 560
        assert ctx.amount_untaxed == 1610.0
        assert ctx.total_cost == 1050.0
        assert ctx.total_margin == 560.0
        # Blended discount: total gross = 1700, disc amount = 90 -> 90 / 1700 * 100 = 5.29%
        assert ctx.blended_discount == 5.29
        assert ctx.dealflow_locked is True
        assert ctx.dealflow_approval_state == APPROVAL_STATE_PENDING

    def test_confirmation_blocking_when_locked(self, sales_adapter, sample_quotation):
        """Tests that an order cannot be confirmed when dealflow_locked is True and unapproved."""
        sample_quotation.dealflow_locked = True
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_PENDING

        with pytest.raises(AuthorizationError) as exc_info:
            sales_adapter.confirm_order(sample_quotation.id, bypass_check=False)

        assert "locked pending DealFlow approval" in str(exc_info.value)
        assert sample_quotation.state == "draft"

    def test_confirmation_blocking_when_discount_exceeds_threshold(self, sales_adapter, sample_quotation):
        """Tests that discount exceeding rep threshold (>10%) blocks confirmation even if not explicitly locked."""
        # Set line discount to 15% (above 10% ceiling)
        for line in sample_quotation.order_line:
            line.discount = 15.0
        sample_quotation._compute_blended_discount()
        sample_quotation.dealflow_locked = False
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_DRAFT

        with pytest.raises(AuthorizationError) as exc_info:
            sales_adapter.confirm_order(sample_quotation.id, bypass_check=False)

        assert "exceeds policy ceiling" in str(exc_info.value)
        assert sample_quotation.state == "draft"

    def test_confirmation_success_after_approval(self, sales_adapter, sample_quotation):
        """Tests that manager approval unlocks the order and allows order confirmation."""
        # 1. Apply approved changes
        approved_changes = {
            "target_line_discounts": {2: 18.0},
            "dealflow_risk_score": 10.0,
            "terms": "Approved by Sales Manager: 18% on Support with 1-year contract",
        }
        res = sales_adapter.apply_approved_change(sample_quotation.id, approved_changes)
        assert res["success"] is True
        assert res["dealflow_approval_state"] == APPROVAL_STATE_APPROVED
        assert res["dealflow_locked"] is False

        # 2. Confirm order succeeds
        confirm_res = sales_adapter.confirm_order(sample_quotation.id)
        assert confirm_res["success"] is True
        assert confirm_res["state"] == "sale"
        assert sample_quotation.state == "sale"

    def test_tamper_guard_reapproval_required(self, sales_adapter, sample_quotation):
        """Tests that modifying discount on an already approved order forces reapproval."""
        # 1. Mark order as approved
        sales_adapter.apply_approved_change(sample_quotation.id, {"discount": 5.0})
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_APPROVED
        assert sample_quotation.dealflow_locked is False

        # 2. Unauthorized write changing line discount
        sample_quotation.write({"order_line": [["write_line", 1, {"discount": 15.0}]]})

        # 3. Verify state transition to reapproval_required and locked
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_REAPPROVAL_REQUIRED
        assert sample_quotation.dealflow_locked is True

        # 4. Confirmation blocked
        with pytest.raises(AuthorizationError):
            sales_adapter.confirm_order(sample_quotation.id)
