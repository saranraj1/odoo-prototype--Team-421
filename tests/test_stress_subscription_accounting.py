# -*- coding: utf-8 -*-
"""DealFlow360 Odoo Integration — Subscription & Accounting Stress Test Suite.

Brutally attacks the Subscription & Accounting subsystem:
1. Hybrid Basket Chaos:
   - Multiple recurring lines with mixed frequencies (Monthly + Annual + Hardware + Services).
   - Normalized MRR / ARR computations across mixed intervals, discounts, quantities.
   - Basket with 0 recurring lines (pure hardware) -> verify 0.0 metrics with zero division guard.
   - Empty basket resilience -> zero division & key safety.
   - Free recurring lines ($0 price or 100% discount) -> freemium renewal and zero division safety.
   - Hybrid free + paid recurring mix.
   - Subscription lifecycle calendar math (leap years, month-ends) and invalid state transitions.

2. Invoicing Lifecycle & Edge Cases:
   - Attempting to invoice unconfirmed orders (draft, sent, cancel) -> MUST raise InvalidStateError.
   - Invoicing an order with 0 lines or $0 amount -> graceful handling, no ZeroDivisionError.
   - Double invoicing protection -> duplicate invoice prevention without new delivery/milestone.
   - Re-invoicing after invoice cancellation -> clean replacement invoice creation.

3. Payment Synchronization & Anomaly States:
   - Overpayment handling: payment clamped to residual, no negative residual corruption.
   - Negative payment rejection: MUST raise ValidationError.
   - Multi-step partial payments: granular residual & payment state synchronization.
   - Payment reversal & refund lifecycle: state reversion from paid to not_paid / reversed.
   - Credit note (out_refund) balancing without liability inflation.
   - Invoice cancellation reflection: sale order reflects accurate amount due, not $0.0.
   - Payment recording on cancelled invoice blocked -> MUST raise InvalidStateError.
   - Standalone mock mode parity with native ORM execution.
"""

from __future__ import annotations

import pytest
from datetime import datetime

from dealflow_odoo.schemas import (
    InvalidStateError,
    NotFoundError,
    ValidationError,
    OrderLineDTO,
)
from dealflow_odoo.services.accounting_adapter import AccountingAdapter
from dealflow_odoo.services.subscription_adapter import SubscriptionAdapter
from tests.conftest import MockRecordSet


class TestStressSubscriptionAccounting:
    """Stress and resilience test suite for SubscriptionAdapter and AccountingAdapter."""

    # =========================================================================
    # ATTACK VECTOR 1: HYBRID BASKET CHAOS
    # =========================================================================

    def test_hybrid_basket_mixed_intervals_and_quantities(self, subscription_adapter):
        """Attacks parser with complex mixed basket: monthly support, annual cloud hosting,

        one-time hardware, deployment services, varying quantities and line discounts.
        """
        # Basket composition:
        # 1. Monthly Support: qty 2, price $500, disc 10% -> subtotal: (2 * 500) * 0.9 = 900.0/mo
        #    MRR = 900.0, ARR = 10,800.0
        # 2. Annual Cloud Hosting: qty 1, price $12,000, disc 0% -> subtotal: 12,000.0/yr
        #    MRR = 12,000 / 12 = 1,000.0, ARR = 12,000.0
        # 3. Hardware Laptop: qty 3, price $1,500, disc 5% -> subtotal: (3 * 1500) * 0.95 = 4,275.0 (one-time)
        # 4. Implementation Services: qty 5, price $200, disc 0% -> subtotal: 1,000.0 (one-time)
        order_dict = {
            "order_id": 101,
            "lines": [
                {
                    "id": 1,
                    "name": "Premium Monthly Support",
                    "product_uom_qty": 2.0,
                    "price_unit": 500.0,
                    "discount": 10.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                },
                {
                    "id": 2,
                    "name": "Annual Dedicated Cloud Cluster",
                    "product_uom_qty": 1.0,
                    "price_unit": 12000.0,
                    "discount": 0.0,
                    "is_recurring": True,
                    "recurring_interval": "year",
                },
                {
                    "id": 3,
                    "name": "Enterprise Laptop Pro",
                    "product_uom_qty": 3.0,
                    "price_unit": 1500.0,
                    "discount": 5.0,
                    "is_recurring": False,
                },
                {
                    "id": 4,
                    "name": "Onboarding & Migration Services",
                    "product_uom_qty": 5.0,
                    "price_unit": 200.0,
                    "discount": 0.0,
                    "is_recurring": False,
                },
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)

        assert parsed["has_recurring"] is True
        assert parsed["has_one_time"] is True
        assert len(parsed["recurring_lines"]) == 2
        assert len(parsed["one_time_lines"]) == 2

        # Verify normalized recurring metrics
        assert parsed["recurring_mrr"] == 1900.0  # 900.0 (monthly) + 1000.0 (annual normalized)
        assert parsed["recurring_arr"] == 22800.0  # 10,800.0 (monthly annualized) + 12,000.0 (annual)

        # Verify one-time total and Total Contract Value (TCV = one-time + ARR)
        assert parsed["one_time_total"] == 5275.0  # 4275.0 + 1000.0
        assert parsed["total_contract_value"] == 28075.0  # 5275.0 + 22800.0

        # Equal interval counts (1 month, 1 year) defaults to "month"
        assert parsed["billing_interval"] == "month"

    def test_hybrid_basket_dominant_interval_resolution(self, subscription_adapter):
        """Attacks interval determination when annual recurring lines outnumber monthly lines."""
        order_dict = {
            "order_id": 102,
            "lines": [
                {
                    "id": 1,
                    "name": "Monthly Base Add-on",
                    "price_unit": 100.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                },
                {
                    "id": 2,
                    "name": "Annual Database Cluster",
                    "price_unit": 6000.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "year",
                },
                {
                    "id": 3,
                    "name": "Annual Backup Vault",
                    "price_unit": 2400.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "year",
                },
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)
        # 2 annual lines vs 1 monthly line -> dominant interval must be "year"
        assert parsed["billing_interval"] == "year"
        # MRR: 100 + (6000/12) + (2400/12) = 100 + 500 + 200 = 800.0
        assert parsed["recurring_mrr"] == 800.0
        # ARR: 1200 + 6000 + 2400 = 9600.0
        assert parsed["recurring_arr"] == 9600.0

    def test_basket_with_zero_recurring_lines_pure_hardware(self, subscription_adapter):
        """Attacks basket with 0 recurring lines, verifying metrics are cleanly 0.0 with no ZeroDivisionError."""
        order_dict = {
            "order_id": 103,
            "lines": [
                {"id": 1, "name": "Workstation PC", "price_unit": 2500.0, "product_uom_qty": 4.0, "is_recurring": False},
                {"id": 2, "name": "UltraWide Monitor", "price_unit": 800.0, "product_uom_qty": 4.0, "is_recurring": False},
                {"id": 3, "name": "Thunderbolt Cable", "price_unit": 50.0, "product_uom_qty": 10.0, "is_recurring": False},
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)

        assert parsed["has_recurring"] is False
        assert parsed["has_one_time"] is True
        assert parsed["recurring_mrr"] == 0.0
        assert parsed["recurring_arr"] == 0.0
        assert parsed["billing_interval"] is None
        assert parsed["one_time_total"] == 13700.0  # (2500*4) + (800*4) + (50*10) = 10000 + 3200 + 500 = 13700
        assert parsed["total_contract_value"] == 13700.0

        # Register in adapter and test status & renewal guards
        subscription_adapter.register_mock_order({"id": 103, "state": "sale", **order_dict})
        status = subscription_adapter.get_subscription_status(103)
        assert status["active"] is False
        assert status["mrr"] == 0.0
        assert status["arr"] == 0.0
        assert status["state"] == "inactive"

        # Attempting renewal on non-recurring order MUST raise ValidationError
        with pytest.raises(ValidationError) as exc:
            subscription_adapter.trigger_subscription_renewal(103)
        assert "no recurring subscription items to renew" in str(exc.value).lower()

    def test_empty_basket_resilience(self, subscription_adapter):
        """Attacks parser with completely empty order structures."""
        # Empty dict
        parsed_empty = subscription_adapter.parse_mixed_order({})
        assert parsed_empty["has_recurring"] is False
        assert parsed_empty["has_one_time"] is False
        assert parsed_empty["recurring_mrr"] == 0.0
        assert parsed_empty["recurring_arr"] == 0.0
        assert parsed_empty["one_time_total"] == 0.0
        assert parsed_empty["billing_interval"] is None

        # Empty lines list
        parsed_no_lines = subscription_adapter.parse_mixed_order({"order_id": 999, "lines": []})
        assert parsed_no_lines["has_recurring"] is False
        assert parsed_no_lines["recurring_mrr"] == 0.0
        assert parsed_no_lines["recurring_arr"] == 0.0

    def test_free_recurring_lines_freemium_tier(self, subscription_adapter):
        """Attacks system with free recurring lines ($0 price or 100% discount promo).

        Verifies no crash, no ZeroDivisionError, and that freemium renewals function.
        """
        # Standalone free tier ($0/mo)
        order_dict_free = {
            "order_id": 104,
            "state": "sale",
            "date_order": "2026-09-05",
            "lines": [
                {
                    "id": 1,
                    "name": "Developer Free Community Tier",
                    "price_unit": 0.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                }
            ],
        }

        parsed_free = subscription_adapter.parse_mixed_order(order_dict_free)
        assert parsed_free["has_recurring"] is True
        assert parsed_free["recurring_mrr"] == 0.0
        assert parsed_free["recurring_arr"] == 0.0
        assert parsed_free["billing_interval"] == "month"
        assert parsed_free["total_contract_value"] == 0.0

        # 100% discount subscription ($500/mo list, 100% off)
        order_dict_promo = {
            "order_id": 105,
            "lines": [
                {
                    "id": 1,
                    "name": "Enterprise 100% Discount Sponsorship",
                    "price_unit": 500.0,
                    "discount": 100.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                }
            ],
        }
        parsed_promo = subscription_adapter.parse_mixed_order(order_dict_promo)
        assert parsed_promo["has_recurring"] is True
        assert parsed_promo["recurring_mrr"] == 0.0
        assert parsed_promo["recurring_arr"] == 0.0

        # Test status and renewal of freemium subscription
        subscription_adapter.register_mock_order(order_dict_free)
        status = subscription_adapter.get_subscription_status(104)
        assert status["active"] is True
        assert status["mrr"] == 0.0
        assert status["state"] == "active"
        assert status["has_recurring"] is True

        # Freemium renewal should succeed without crashing, generating $0 renewal invoice
        renewal = subscription_adapter.trigger_subscription_renewal(104)
        assert renewal["success"] is True
        assert renewal["amount_invoiced"] == 0.0
        assert renewal["state"] == "renewed"
        assert renewal["previous_renewal_date"] == "2026-10-05"
        assert renewal["next_renewal_date"] == "2026-11-05"

    def test_hybrid_basket_free_and_paid_recurring_mix(self, subscription_adapter):
        """Attacks hybrid basket with free recurring line + paid recurring line + one-time hardware."""
        order_dict = {
            "order_id": 106,
            "lines": [
                {
                    "id": 1,
                    "name": "Free Telemetry Add-on",
                    "price_unit": 0.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                },
                {
                    "id": 2,
                    "name": "Paid Production Database Service",
                    "price_unit": 350.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": True,
                    "recurring_interval": "month",
                },
                {
                    "id": 3,
                    "name": "Dedicated Server Hardware",
                    "price_unit": 2000.0,
                    "product_uom_qty": 1.0,
                    "is_recurring": False,
                },
            ],
        }

        parsed = subscription_adapter.parse_mixed_order(order_dict)
        assert parsed["has_recurring"] is True
        assert parsed["has_one_time"] is True
        assert parsed["recurring_mrr"] == 350.0
        assert parsed["recurring_arr"] == 4200.0
        assert parsed["one_time_total"] == 2000.0
        assert parsed["total_contract_value"] == 6200.0
        assert len(parsed["recurring_lines"]) == 2

    def test_subscription_lifecycle_calendar_and_leap_year(self, subscription_adapter):
        """Attacks subscription renewal date calculation across leap years and month-end transitions."""
        from dealflow_odoo.services.subscription_adapter import _add_billing_period

        # Leap year handling: Feb 29, 2024 + 1 year -> Feb 28, 2025
        next_leap = _add_billing_period("2024-02-29", "year")
        assert next_leap == "2025-02-28"

        # Month-end handling: Jan 31, 2026 + 1 month -> Feb 28, 2026
        next_month_end = _add_billing_period("2026-01-31", "month")
        assert next_month_end == "2026-02-28"

        # Month-end handling in leap year: Jan 31, 2024 + 1 month -> Feb 29, 2024
        next_leap_month = _add_billing_period("2024-01-31", "month")
        assert next_leap_month == "2024-02-29"

        # Year-end rollover: Dec 15, 2026 + 1 month -> Jan 15, 2027
        next_year_rollover = _add_billing_period("2026-12-15", "month")
        assert next_year_rollover == "2027-01-15"

    def test_subscription_renewal_blocked_on_inactive_states(self, subscription_adapter):
        """Attacks renewal mechanism when order is in draft or cancelled state."""
        # 1. Draft order
        subscription_adapter.register_mock_order({
            "id": 107,
            "state": "draft",
            "lines": [{"id": 1, "name": "Support", "price_unit": 500.0, "is_recurring": True, "recurring_interval": "month"}],
        })
        with pytest.raises(InvalidStateError) as exc_draft:
            subscription_adapter.trigger_subscription_renewal(107)
        assert "must be active" in str(exc_draft.value).lower()

        # 2. Cancelled order
        subscription_adapter.register_mock_order({
            "id": 108,
            "state": "cancel",
            "lines": [{"id": 1, "name": "Support", "price_unit": 500.0, "is_recurring": True, "recurring_interval": "month"}],
        })
        with pytest.raises(InvalidStateError) as exc_cancel:
            subscription_adapter.trigger_subscription_renewal(108)
        assert "must be active" in str(exc_cancel.value).lower()

    # =========================================================================
    # ATTACK VECTOR 2: INVOICING LIFECYCLE & EDGE CASES
    # =========================================================================

    def test_invoice_draft_and_unconfirmed_order_blocked(self, accounting_adapter, sample_quotation):
        """Attacks invoice creation against unconfirmed orders (draft, sent, cancel).

        MUST raise InvalidStateError in all cases.
        """
        # 1. State: draft
        sample_quotation.state = "draft"
        with pytest.raises(InvalidStateError) as exc_draft:
            accounting_adapter.create_invoice(sample_quotation.id)
        assert "must be confirmed" in str(exc_draft.value).lower()

        # 2. State: sent
        sample_quotation.state = "sent"
        with pytest.raises(InvalidStateError) as exc_sent:
            accounting_adapter.create_invoice(sample_quotation.id)
        assert "must be confirmed" in str(exc_sent.value).lower()

        # 3. State: cancel
        sample_quotation.state = "cancel"
        with pytest.raises(InvalidStateError) as exc_cancel:
            accounting_adapter.create_invoice(sample_quotation.id)
        assert "must be confirmed" in str(exc_cancel.value).lower()

    def test_invoice_zero_lines_or_zero_amount_order_graceful(self, accounting_adapter, mock_odoo_env, seed_data):
        """Attacks invoicing with an order containing 0 lines and 0.0 amount.

        Verifies graceful handling with zero crashes or ZeroDivisionErrors.
        """
        SaleOrder = mock_odoo_env["sale.order"]
        acme = seed_data["customers"]["acme"]

        zero_order = SaleOrder.create({
            "id": 201,
            "name": "SO-ZERO-001",
            "partner_id": acme,
            "state": "sale",  # Confirmed zero-dollar order (e.g. warranty replacement or free trial)
            "amount_untaxed": 0.0,
            "amount_tax": 0.0,
            "amount_total": 0.0,
            "dealflow_deal_id": "DEAL-ZERO-001",
        })
        zero_order.order_line = MockRecordSet([], "sale.order.line")

        # Invoicing zero amount order must succeed without crashing
        inv_res = accounting_adapter.create_invoice(201)
        assert inv_res["invoice_id"] > 0
        assert inv_res["amount_total"] == 0.0

        # Invoice details inspection
        inv_details = accounting_adapter.get_invoice(inv_res["invoice_id"])
        assert inv_details["amount_total"] == 0.0
        assert inv_details["amount_residual"] == 0.0
        assert inv_details["is_paid"] is True

        # Payment status inspection: 0 total, 0 due -> is_paid=True, state=paid
        status = accounting_adapter.get_payment_status(201)
        assert status["amount_paid"] == 0.0
        assert status["amount_due"] == 0.0
        assert status["is_paid"] is True
        assert status["payment_state"] == "paid"

    def test_double_invoicing_prevented(self, accounting_adapter, sample_quotation):
        """Attacks invoicing by attempting duplicate invoice creation for the same confirmed order

        without additional delivery or milestones.
        Double invoicing MUST be blocked with InvalidStateError to prevent double-billing.
        """
        sample_quotation.state = "sale"

        # First invoice: legitimate initial invoicing
        inv1 = accounting_adapter.create_invoice(sample_quotation.id)
        assert inv1["invoice_id"] > 0
        assert inv1["amount_total"] == 1870.0

        # Second invoice attempt: duplicate invoicing attempt without new lines or deliveries
        with pytest.raises(InvalidStateError) as exc_info:
            accounting_adapter.create_invoice(sample_quotation.id)

        assert "already fully invoiced" in str(exc_info.value).lower()

        # Verify payment status is NOT corrupted with double liability ($3740)
        status = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status["amount_due"] == 1870.0  # NOT 3740.0
        assert status["invoices_count"] == 1   # Only 1 invoice linked

    def test_re_invoicing_after_cancellation_allowed(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Attacks invoicing after an existing invoice was cancelled.

        Re-invoicing a cancelled invoice MUST be permitted and restore active billing.
        """
        sample_quotation.state = "sale"

        # 1. Create first invoice
        inv1 = accounting_adapter.create_invoice(sample_quotation.id)
        inv1_id = inv1["invoice_id"]

        # 2. Cancel first invoice
        inv_record = mock_odoo_env["account.move"].browse(inv1_id)
        inv_record.write({"state": "cancel"})

        # 3. Create replacement invoice -> MUST succeed now that previous invoice is cancelled
        inv2 = accounting_adapter.create_invoice(sample_quotation.id)
        assert inv2["invoice_id"] > 0
        assert inv2["invoice_id"] != inv1_id
        assert inv2["state"] == "posted"

        # 4. Verify payment status reflects only active replacement invoice
        status = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status["amount_due"] == 1870.0
        assert status["invoices_count"] == 1  # 1 active invoice (cancelled one excluded from active count)

    # =========================================================================
    # ATTACK VECTOR 3: PAYMENT SYNCHRONIZATION & ANOMALY STATES
    # =========================================================================

    def test_overpayment_resilience_and_clamping(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Attacks payment recording with overpayment amount exceeding invoice residual.

        Payment must clamp to outstanding residual, prevent negative balances,
        and reject negative payment amounts.
        """
        sample_quotation.state = "sale"
        inv = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv["invoice_id"]

        # 1. Overpayment attack: Invoice is $1,870.0, attempt to pay $2,500.0 (excess $630.0)
        pay_res = accounting_adapter.record_payment(inv_id, amount=2500.0)
        assert pay_res["amount_paid"] == 1870.0   # Clamped to residual
        assert pay_res["amount_residual"] == 0.0  # Cannot become negative
        assert pay_res["payment_state"] == "paid"
        assert pay_res["is_paid"] is True

        # Verify underlying ORM account.move record persisted properly
        inv_details = accounting_adapter.get_invoice(inv_id)
        assert inv_details["amount_residual"] == 0.0
        assert inv_details["payment_state"] == "paid"
        assert inv_details["is_paid"] is True

        # Verify order level payment status
        status = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status["amount_paid"] == 1870.0
        assert status["amount_due"] == 0.0
        assert status["is_paid"] is True

        # 2. Negative payment attack: Attempting to record negative amount MUST raise ValidationError
        with pytest.raises(ValidationError) as exc_neg:
            accounting_adapter.record_payment(inv_id, amount=-500.0)
        assert "cannot be negative" in str(exc_neg.value).lower()

    def test_partial_payments_synchronization_lifecycle(self, accounting_adapter, sample_quotation):
        """Attacks payment synchronization with multi-step partial payments.

        Step 1: Partial payment $500 -> in_payment, residual $1370.
        Step 2: Partial payment $1000 -> in_payment, residual $370.
        Step 3: Final payment $370 -> paid, residual $0.
        """
        sample_quotation.state = "sale"
        inv = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv["invoice_id"]

        # Step 1: Pay $500 of $1870
        pay1 = accounting_adapter.record_payment(inv_id, amount=500.0)
        assert pay1["amount_paid"] == 500.0
        assert pay1["amount_residual"] == 1370.0
        assert pay1["payment_state"] == "in_payment"
        assert pay1["is_paid"] is False

        status1 = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status1["amount_paid"] == 500.0
        assert status1["amount_due"] == 1370.0
        assert status1["payment_state"] == "in_payment"
        assert status1["is_paid"] is False

        # Step 2: Pay another $1000 (total paid $1500)
        pay2 = accounting_adapter.record_payment(inv_id, amount=1000.0)
        assert pay2["amount_paid"] == 1000.0
        assert pay2["amount_residual"] == 370.0
        assert pay2["payment_state"] == "in_payment"
        assert pay2["is_paid"] is False

        status2 = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status2["amount_paid"] == 1500.0
        assert status2["amount_due"] == 370.0
        assert status2["payment_state"] == "in_payment"
        assert status2["is_paid"] is False

        # Step 3: Pay remaining $370 (total paid $1870)
        pay3 = accounting_adapter.record_payment(inv_id, amount=370.0)
        assert pay3["amount_paid"] == 370.0
        assert pay3["amount_residual"] == 0.0
        assert pay3["payment_state"] == "paid"
        assert pay3["is_paid"] is True

        status3 = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status3["amount_paid"] == 1870.0
        assert status3["amount_due"] == 0.0
        assert status3["payment_state"] == "paid"
        assert status3["is_paid"] is True

    def test_payment_reversal_and_refund_lifecycle(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Attacks payment state synchronization with payment reversal / chargeback

        and credit notes (out_refund).
        """
        sample_quotation.state = "sale"
        inv = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv["invoice_id"]

        # 1. Pay invoice fully
        accounting_adapter.record_payment(inv_id)
        assert accounting_adapter.get_invoice(inv_id)["is_paid"] is True
        assert accounting_adapter.get_payment_status(sample_quotation.id)["is_paid"] is True

        # 2. Simulate payment reversal (un-reconciliation / chargeback)
        inv_record = mock_odoo_env["account.move"].browse(inv_id)
        inv_record.write({
            "payment_state": "not_paid",
            "amount_residual": 1870.0,
        })

        # Verify invoice reflects un-paid reversed state
        inv_reversed = accounting_adapter.get_invoice(inv_id)
        assert inv_reversed["payment_state"] == "not_paid"
        assert inv_reversed["amount_residual"] == 1870.0
        assert inv_reversed["is_paid"] is False

        # Verify sale order reflects reversed balance
        status_reversed = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_reversed["amount_paid"] == 0.0
        assert status_reversed["amount_due"] == 1870.0
        assert status_reversed["payment_state"] == "not_paid"
        assert status_reversed["is_paid"] is False

        # 3. Credit Note / Refund handling: Create out_refund move linked to order
        # Refund should NOT inflate total_invoiced to $3740
        refund_move = mock_odoo_env["account.move"].create({
            "name": "RND/2026/0001",
            "partner_id": sample_quotation.partner_id,
            "amount_total": 1870.0,
            "amount_residual": 0.0,
            "state": "posted",
            "payment_state": "paid",
            "move_type": "out_refund",
            "order_id": sample_quotation.id,
        })
        existing_invoices = list(sample_quotation.invoice_ids)
        existing_invoices.append(refund_move)
        sample_quotation.invoice_ids = MockRecordSet(existing_invoices, "account.move")

        # Verify credit note move_type is returned
        refund_details = accounting_adapter.get_invoice(refund_move.id)
        assert refund_details["move_type"] == "out_refund"

        # Payment status should not artificially double invoiced liabilities
        status_refunded = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status_refunded["amount_due"] <= 1870.0

    def test_invoice_cancellation_order_status_reflection(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Attacks payment status inspection when all invoices for a confirmed order are cancelled.

        Order is still unpaid, so amount_due MUST reflect order amount ($1870), NOT $0.0.
        """
        sample_quotation.state = "sale"
        inv = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv["invoice_id"]

        # Cancel the invoice
        inv_record = mock_odoo_env["account.move"].browse(inv_id)
        inv_record.write({"state": "cancel"})

        # Verify invoice list still includes cancelled invoice for audit trail
        order_invoices = accounting_adapter.get_order_invoices(sample_quotation.id)
        assert len(order_invoices) == 1
        assert order_invoices[0]["state"] == "cancel"

        # Verify payment status: cancelled invoice means order is unpaid -> amount_due = 1870.0
        status = accounting_adapter.get_payment_status(sample_quotation.id)
        assert status["is_paid"] is False
        assert status["amount_paid"] == 0.0
        assert status["amount_due"] == 1870.0  # RESILIENCE CHECK: Must NOT be 0.0!
        assert status["payment_state"] == "not_paid"

    def test_payment_on_cancelled_invoice_blocked(self, accounting_adapter, sample_quotation, mock_odoo_env):
        """Attacks payment recording on a cancelled invoice.

        MUST raise InvalidStateError to prevent applying payments to voided accounting moves.
        """
        sample_quotation.state = "sale"
        inv = accounting_adapter.create_invoice(sample_quotation.id)
        inv_id = inv["invoice_id"]

        inv_record = mock_odoo_env["account.move"].browse(inv_id)
        inv_record.write({"state": "cancel"})

        with pytest.raises(InvalidStateError) as exc_info:
            accounting_adapter.record_payment(inv_id, amount=500.0)

        assert "cancelled invoice" in str(exc_info.value).lower()

    def test_standalone_mock_mode_parity(self):
        """Attacks AccountingAdapter in standalone mode (no env, no RPC) to verify

        complete functional parity with native ORM execution.
        """
        adapter = AccountingAdapter()

        order_dict = {
            "id": 301,
            "name": "SO-MOCK-301",
            "state": "sale",
            "amount_total": 5000.0,
            "dealflow_deal_id": "DEAL-MOCK-301",
        }
        adapter.register_mock_order(order_dict)

        # 1. Invoice creation
        inv = adapter.create_invoice(301)
        inv_id = inv["invoice_id"]
        assert inv["amount_total"] == 5000.0
        assert inv["state"] == "posted"

        # 2. Double invoicing guard in standalone mode
        with pytest.raises(InvalidStateError):
            adapter.create_invoice(301)

        # 3. Partial payment
        adapter.record_payment(inv_id, amount=2000.0)
        status1 = adapter.get_payment_status(301)
        assert status1["amount_paid"] == 2000.0
        assert status1["amount_due"] == 3000.0
        assert status1["payment_state"] == "in_payment"
        assert status1["is_paid"] is False

        # 4. Overpayment completion
        adapter.record_payment(inv_id, amount=4000.0)  # Overpay: $4000 when only $3000 due
        status2 = adapter.get_payment_status(301)
        assert status2["amount_paid"] == 5000.0
        assert status2["amount_due"] == 0.0
        assert status2["payment_state"] == "paid"
        assert status2["is_paid"] is True
