"""Unit tests for GOV-01 Policy Resolution Engine."""

from app.governance.policy.resolver import PolicyResolver
from app.governance.policy.models import DiscountPolicy


def test_effective_ceiling_strictest_rule():
    """Verify MIN(customer_tier_limit, category_limit) rule."""
    resolver = PolicyResolver()

    # Gold (15%) + Hardware (15%) -> 15%
    tier, cat, ceiling = resolver.resolve_effective_limits("Gold", "Hardware")
    assert tier == 15.0
    assert cat == 15.0
    assert ceiling == 15.0

    # Gold (15%) + Services (10%) -> 10% (Category is stricter)
    tier, cat, ceiling = resolver.resolve_effective_limits("Gold", "Services")
    assert tier == 15.0
    assert cat == 10.0
    assert ceiling == 10.0

    # Bronze (5%) + Hardware (15%) -> 5% (Tier is stricter)
    tier, cat, ceiling = resolver.resolve_effective_limits("Bronze", "Hardware")
    assert tier == 5.0
    assert cat == 15.0
    assert ceiling == 5.0


def test_demo_quote_policy_evaluation(sample_gold_deal):
    """Verify evaluation of the standard demo quotation."""
    resolver = PolicyResolver()
    result = resolver.resolve_policy(sample_gold_deal)

    assert result.has_violations is True
    assert result.violations_count == 1
    assert result.max_excess == 8.0

    # Line 1: Laptop 12% discount (Compliant)
    laptop_res = result.line_results[0]
    assert laptop_res.actual_discount == 12.0
    assert laptop_res.effective_ceiling == 15.0
    assert laptop_res.excess == 0.0
    assert laptop_res.is_violation is False

    # Line 2: Setup Service 18% discount (Violation!)
    service_res = result.line_results[1]
    assert service_res.actual_discount == 18.0
    assert service_res.effective_ceiling == 10.0
    assert service_res.excess == 8.0
    assert service_res.is_violation is True
    assert "exceeds Services ceiling (10.0%) by 8.0%" in service_res.reason


def test_compliant_deal_evaluation(sample_compliant_deal):
    """Verify deal with zero violations."""
    resolver = PolicyResolver()
    result = resolver.resolve_policy(sample_compliant_deal)

    assert result.has_violations is False
    assert result.violations_count == 0
    assert result.max_excess == 0.0
    assert result.line_results[0].is_violation is False


def test_custom_policy_override():
    """Verify that custom configured policies override defaults."""
    custom_policies = [
        DiscountPolicy(
            name="Special Gold Promotion",
            customer_tier="Gold",
            max_discount_pct=25.0,
            priority=50,
            active=True
        ),
        DiscountPolicy(
            name="Restricted Services",
            category_name="Services",
            max_discount_pct=8.0,
            priority=50,
            active=True
        )
    ]
    resolver = PolicyResolver(custom_policies=custom_policies)
    tier, cat, ceiling = resolver.resolve_effective_limits("Gold", "Services")

    assert tier == 25.0
    assert cat == 8.0
    assert ceiling == 8.0  # MIN(25.0, 8.0)
