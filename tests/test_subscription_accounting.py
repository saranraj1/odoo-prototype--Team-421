# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Subscription & Accounting Integration Test Suite.

Verifies:
- Mixed order classification (separating one-time products from recurring lines)
- Calculation of Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR)
- Support for monthly vs annual billing intervals
- Pure one-time order handling without recurring artifacts
- Invoice creation for confirmed sales orders with dealflow_deal_id assignment
- Invoicing guard: preventing invoice creation for unconfirmed (draft) orders
- Real-time payment state tracking and synchronization from unpaid to paid
- Multi-invoice aggregation for complex customer billing schedules
"""

from __future__ import annotations

import pytest

from dealflow_odoo.schemas import (
    InvalidStateError,
    NotFoundError,
    ValidationError,
)


class TestSubscriptionAccounting:
    """Test suite for SubscriptionAdapter and AccountingAdapter."""

    def test_parse_mixed_order_laptop_and_support(self, subscription_adapter, sample_quotation):
        """Tests parsing a hybrid order (1x Laptop one-time + 1x Premium Support monthly)."""
        order_dict = {
            "order_id": sample_quotation.id,
            "lines": [
                {
                    "id": 1,
                    "product_name": "Laptop",
                    "category_name": "Hardware",
                    "product_uom_qty": 1.0,
                    "price_unit": 1200.0,
                    "discount": 0.0,
                    "price_subtotal": 1200.0,
                    "is_recurring": False,
                },
                {
                    "id": 2,
                    "product_name": "Premium Support",
                    "category_name": "Subscription",
                    "product_uom_qty": 1.0,
                    "price_unit": 500.0,
                    "discount": 0.0,
                    "price_subtotal": 500.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                },
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)
        assert parsed["has_recurring"] is True
        assert parsed["has_one_time"] is True
        assert parsed["one_time_total"] == 1200.0
        assert parsed["recurring_mrr"] == 500.0
        assert parsed["recurring_arr"] == 6000.0
        assert parsed["billing_interval"] == "month"
        assert len(parsed["one_time_lines"]) == 1
        assert len(parsed["recurring_lines"]) == 1

    def test_parse_annual_subscription_mrr_arr(self, subscription_adapter):
        """Tests calculating MRR and ARR for an annual recurring subscription."""
        order_dict = {
            "order_id": 99,
            "lines": [
                {
                    "id": 10,
                    "product_name": "Enterprise Annual Support",
                    "category_name": "Subscription",
                    "product_uom_qty": 1.0,
                    "price_unit": 12000.0,
                    "discount": 0.0,
                    "price_subtotal": 12000.0,
                    "is_recurring": True,
                    "recurring_interval": "year",
                }
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)
        assert parsed["has_recurring"] is True
        assert parsed["has_one_time"] is False
        assert parsed["one_time_total"] == 0.0
        assert parsed["recurring_arr"] == 12000.0
        assert parsed["recurring_mrr"] == 1000.0  # 12,000 / 12 months
        assert parsed["billing_interval"] == "year"

    def test_pure_one_time_order(self, subscription_adapter):
        """Tests pure hardware one-time purchase with no recurring metrics."""
        order_dict = {
            "order_id": 100,
            "lines": [
                {
                    "id": 1,
                    "product_name": "Laptop",
                    "category_name": "Hardware",
                    "product_uom_qty": 2.0,
                    "price_unit": 1200.0,
                    "discount": 10.0,
                    "price_subtotal": 2160.0,
                    "is_recurring": False,
                },
                {
                    "id": 2,
                    "product_name": "Monitor",
                    "category_name": "Hardware",
                    "product_uom_qty": 2.0,
                    "price_unit": 300.0,
                    "discount": 0.0,
                    "price_subtotal": 600.0,
                    "is_recurring": False,
                },
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)
        assert parsed["has_recurring"] is False
        assert parsed["has_one_time"] is True
        assert parsed["one_time_total"] == 2760.0
        assert parsed["recurring_mrr"] == 0.0
        assert parsed["recurring_arr"] == 0.0
        assert parsed["billing_interval"] is None

    def test_create_invoice_confirmed_order(self, accounting_adapter, sample_quotation):
        """Tests atomic invoice generation on a confirmed sale order with dealflow_deal_id propagation."""
        # Confirm order first
        sample_quotation.state = "sale"

        inv_res = accounting_adapter.create_invoice(sample_quotation.id)
        assert inv_res["invoice_id"] > 0
        assert "INV/" in inv_res["name"]
        assert inv_res["amount_total"] == 1870.0
        assert inv_res["payment_state"] == "not_paid"
        assert inv_res["dealflow_deal_id"] == "DEAL-ACME-001"

    def test_create_invoice_unconfirmed_order_blocked(self, accounting_adapter, sample_quotation):
        """Tests that attempting to invoice a draft/unconfirmed order raises InvalidStateError."""
        sample_quotation.state = "draft"

        with pytest.raises(InvalidStateError) as exc_info:
            accounting_adapter.create_invoice(sample_quotation.id)

        assert "must be confirmed" in str(exc_info.value).lower()

    def test_get_invoice_details(self, accounting_adapter, sample_quotation):
        """Tests inspecting invoice status, totals, and payment state."""
        sample_quotation.state = "sale"
        inv_res = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv_res["invoice_id"]

        details = accounting_adapter.get_invoice(inv_id)
        assert details["invoice_id"] == inv_id
        assert details["amount_total"] == 1870.0
        assert details["payment_state"] == "not_paid"

    def test_get_payment_status_sync(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Tests real-time payment status tracking from unpaid to fully paid."""
        sample_quotation.state = "sale"
        inv_res = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv_res["invoice_id"]

        # 1. Unpaid state
        status_unpaid = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_unpaid["invoices_count"] >= 1
        assert status_unpaid["is_paid"] is False
        assert status_unpaid["payment_state"] == "not_paid"
        assert status_unpaid["amount_due"] == 1870.0
        assert status_unpaid["amount_paid"] == 0.0

        # 2. Simulate payment recording on the invoice
        inv_record = mock_odoo_env["account.move"].browse(inv_id)
        inv_record.write({"payment_state": "paid", "amount_residual": 0.0})

        # 3. Synchronized paid state
        status_paid = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_paid["is_paid"] is True
        assert status_paid["payment_state"] == "paid"
        assert status_paid["amount_due"] == 0.0

    def test_get_order_invoices_list(self, accounting_adapter, sample_quotation):
        """Tests retrieving all invoice summaries associated with a sale order."""
        sample_quotation.state = "sale"
        accounting_adapter.create_invoice(sample_quotation.id)

        invoices = accounting_adapter.get_order_invoices(sample_quotation.id)
        assert len(invoices) >= 1
        assert invoices[0]["amount_total"] == 1870.0
        assert invoices[0]["dealflow_deal_id"] == "DEAL-ACME-001"
