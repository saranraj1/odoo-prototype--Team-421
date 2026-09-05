"""Brutal Stress Test Suite: Sales, Governance, Pricing Invariants & Edge-Case Fuzzing.

Executed by Principal System Design Tester to audit and fuzz every boundary of:
- sale_order.py
- sale_order_line.py
- sales_adapter.py
- schemas.py
"""

import pytest
from typing import Dict, Any

from dealflow_odoo.constants import (
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_REJECTED,
    APPROVAL_STATE_REAPPROVAL_REQUIRED,
    DEFAULT_MAX_REP_DISCOUNT,
    DEFAULT_MAX_MGR_DISCOUNT,
    DEFAULT_FINANCE_DISCOUNT_THRESHOLD,
    CATEGORY_DISCOUNT_CEILINGS,
)
from dealflow_odoo.schemas import (
    ValidationError,
    AuthorizationError,
    NotFoundError,
    InvalidStateError,
)
from dealflow_odoo.services.sales_adapter import SalesAdapter


class TestStressDiscountsAndFuzzing:
    """Brutally test boundary, negative, and extreme discount values."""

    def test_negative_discount_rejected_at_order_update(self, sales_adapter: SalesAdapter, sample_quotation):
        """Negative discounts (-5.0%) violate pricing invariants and must raise ValidationError."""
        with pytest.raises(ValidationError) as exc:
            sales_adapter.update_order(
                sample_quotation.id,
                {"lines": [{"id": sample_quotation.order_line[0].id, "discount": -5.0}]},
            )
        assert "between 0.0% and 100.0%" in str(exc.value)

    def test_negative_discount_rejected_at_approved_change(self, sales_adapter: SalesAdapter, sample_quotation):
        """Negative discounts in approved change payloads must be blocked."""
        with pytest.raises(ValidationError) as exc:
            sales_adapter.apply_approved_change(
                sample_quotation.id,
                {"discount": -10.0},
            )
        assert "between 0.0% and 100.0%" in str(exc.value)

    def test_excessive_discount_above_100_rejected(self, sales_adapter: SalesAdapter, sample_quotation):
        """Discounts > 100% (e.g. 105.0%) must raise ValidationError."""
        with pytest.raises(ValidationError) as exc:
            sales_adapter.update_order(
                sample_quotation.id,
                {"lines": [{"id": sample_quotation.order_line[0].id, "discount": 105.0}]},
            )
        assert "between 0.0% and 100.0%" in str(exc.value)

    def test_zero_percent_clean_discount(self, sales_adapter: SalesAdapter, sample_quotation):
        """0.0% discount should compute accurate margin and zero discount."""
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        assert ctx.blended_discount == 0.0
        assert ctx.dealflow_approval_state in (APPROVAL_STATE_DRAFT, APPROVAL_STATE_APPROVED)

    def test_100_percent_free_deal_requires_finance_approval(self, sales_adapter: SalesAdapter, sample_quotation):
        """100.0% discount is an extreme promotional deal requiring Finance approval."""
        # Update order to 100% discount
        sales_adapter.update_order(
            sample_quotation.id,
            {"lines": [{"id": sample_quotation.order_line[0].id, "discount": 100.0}]},
        )
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        assert ctx.lines[0].discount == 100.0
        assert ctx.lines[0].price_subtotal == 0.0

        # Rep tries to confirm 100% discount deal without Finance approval
        with pytest.raises(AuthorizationError):
            sales_adapter.confirm_order(sample_quotation.id)

    def test_fractional_precision_discount_rounding(self, sales_adapter: SalesAdapter, sample_quotation):
        """Discounts with high float precision (18.4567%) must not cause precision divergence."""
        sales_adapter.update_order(
            sample_quotation.id,
            {"lines": [{"id": sample_quotation.order_line[0].id, "discount": 18.4567}]},
        )
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        assert round(ctx.lines[0].discount, 2) == 18.46


class TestBoundaryPricingAndQuantities:
    """Stress-test zero unit price, negative quantities, and cost inversions."""

    def test_zero_quantity_rejected(self, sales_adapter: SalesAdapter, sample_quotation):
        """0 quantity on an order line must raise ValidationError."""
        with pytest.raises(ValidationError) as exc:
            sales_adapter.update_order(
                sample_quotation.id,
                {"lines": [{"id": sample_quotation.order_line[0].id, "product_uom_qty": 0.0}]},
            )
        assert "Quantity must be strictly positive" in str(exc.value)

    def test_negative_quantity_rejected(self, sales_adapter: SalesAdapter, sample_quotation):
        """Negative quantity must raise ValidationError."""
        with pytest.raises(ValidationError) as exc:
            sales_adapter.update_order(
                sample_quotation.id,
                {"lines": [{"id": sample_quotation.order_line[0].id, "product_uom_qty": -5.0}]},
            )
        assert "Quantity must be strictly positive" in str(exc.value)

    def test_cost_greater_than_unit_price_negative_margin(self, sales_adapter: SalesAdapter, sample_quotation):
        """Selling below cost price produces negative margin."""
        sales_adapter.update_order(
            sample_quotation.id,
            {"lines": [{"id": sample_quotation.order_line[0].id, "price_unit": 500.0}]},  # Cost is 800
        )
        ctx = sales_adapter.get_deal_context(sample_quotation.id)
        line = ctx.lines[0]
        assert line.cost_price == 800.0
        assert line.margin < 0.0
        assert line.margin_percent < 0.0


class TestMixedCategoryCeilingBreaches:
    """Verify that independent category ceiling breaches trigger governance."""

    def test_line_level_category_breach_blocks_confirmation(self, sales_adapter: SalesAdapter, sample_quotation):
        """Service line with 18% discount breaches 15% category ceiling.

        Even if blended discount was below threshold, category breach blocks confirmation!
        """
        # Find the service line or add one
        lines = sample_quotation.order_line
        service_line = None
        for l in lines:
            if "Support" in l.name or "Service" in l.name:
                service_line = l
                break

        assert service_line is not None
        # Apply 18% discount to Service line (allowed is 10% or 15%)
        sales_adapter.update_order(
            sample_quotation.id,
            {"lines": [{"id": service_line.id, "discount": 18.0}]},
        )

        # Confirming without approval must raise AuthorizationError detailing category breach
        with pytest.raises(AuthorizationError) as exc:
            sales_adapter.confirm_order(sample_quotation.id)
        assert "exceeds policy ceiling" in str(exc.value) or "Category breach" in str(exc.value) or "locked" in str(exc.value)


class TestStateMachineTamperAndRaceGuards:
    """Verify tamper invalidation, lock engagement, and idempotent updates."""

    def test_modifying_approved_order_triggers_reapproval_required(self, sales_adapter: SalesAdapter, sample_quotation):
        """Modifying an approved quotation resets state to 'reapproval_required' and locks it."""
        # First approve the order
        sales_adapter.apply_approved_change(sample_quotation.id, {"discount": 15.0})
        ctx_before = sales_adapter.get_deal_context(sample_quotation.id)
        assert ctx_before.dealflow_approval_state == APPROVAL_STATE_APPROVED

        # Now someone tampers with discount directly
        sales_adapter.update_order(
            sample_quotation.id,
            {"lines": [{"id": sample_quotation.order_line[0].id, "discount": 25.0}]},
        )
        ctx_after = sales_adapter.get_deal_context(sample_quotation.id)
        assert ctx_after.dealflow_approval_state == APPROVAL_STATE_REAPPROVAL_REQUIRED
        assert ctx_after.dealflow_locked is True

    def test_idempotent_apply_approved_change(self, sales_adapter: SalesAdapter, sample_quotation):
        """Applying the exact same approved change twice produces consistent state."""
        res1 = sales_adapter.apply_approved_change(sample_quotation.id, {"discount": 12.0})
        res2 = sales_adapter.apply_approved_change(sample_quotation.id, {"discount": 12.0})
        assert res1["dealflow_approval_state"] == APPROVAL_STATE_APPROVED
        assert res2["dealflow_approval_state"] == APPROVAL_STATE_APPROVED

    def test_cannot_update_or_confirm_cancelled_order(self, sales_adapter: SalesAdapter, sample_quotation):
        """Cancelled orders strictly reject updates and confirmation."""
        sample_quotation.state = "cancel"
        with pytest.raises(InvalidStateError):
            sales_adapter.update_order(sample_quotation.id, {"note": "Should fail"})
        with pytest.raises(InvalidStateError):
            sales_adapter.confirm_order(sample_quotation.id)
