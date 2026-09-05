import { CustomerTier, ProductCategory } from '../types';

/**
 * STRICT CUSTOMER TIER MAXIMUM CEILINGS
 * Fixed Business Rules:
 * GOLD   -> Maximum discount = 15.0%
 * SILVER -> Maximum discount = 10.0%
 * BRONZE -> Maximum discount = 5.0%
 *
 * A customer must NEVER receive a discount above their tier limit!
 */
export const CUSTOMER_TIER_CAPS: Record<CustomerTier, number> = {
  GOLD: 15.0,
  SILVER: 10.0,
  BRONZE: 5.0,
};

export const CATEGORY_CEILINGS: Record<ProductCategory, number> = {
  HARDWARE: 15.0,
  SOFTWARE: 20.0,
  SERVICES: 10.0,
  SUBSCRIPTION: 15.0,
};

/**
 * Authoritative Ceiling Doctrine:
 * Ceiling = min(Customer Tier Limit, Category Limit)
 * Gold customer on Services: min(15%, 10%) = 10%
 * Bronze customer on Hardware: min(5%, 15%) = 5%
 * Bronze customer on Services: min(5%, 10%) = 5%
 */
export function getEffectiveCeiling(tier: CustomerTier, category: ProductCategory): number {
  const tierLimit = CUSTOMER_TIER_CAPS[tier] ?? 5.0;
  const categoryLimit = CATEGORY_CEILINGS[category] ?? 10.0;
  return Math.min(tierLimit, categoryLimit);
}

/**
 * Direct Customer Tier Limit Check
 */
export function getCustomerTierMaxDiscount(tier: CustomerTier): number {
  return CUSTOMER_TIER_CAPS[tier] ?? 5.0;
}
