import { CustomerTier, LineItem, ProductCategory } from '../types';
import { getEffectiveCeiling, getCustomerTierMaxDiscount, CATEGORY_CEILINGS } from '../data/policies';

export interface PolicyCheckResult {
  lineId: string;
  productName: string;
  category: string;
  appliedDiscount: number;
  tierLimit: number;
  categoryLimit: number;
  effectiveCeiling: number;
  excessPercent: number;
  isBreached: boolean;
  isTierBreached: boolean;
  reasonCode: 'WITHIN_POLICY' | 'EXCEEDS_CATEGORY_CEILING' | 'EXCEEDS_TIER_CAP';
  explanation: string;
}

export interface DiscountValidationResult {
  isValid: boolean;
  tier: CustomerTier;
  tierLimit: number;
  appliedDiscount: number;
  remainingCapacity: number;
  isTierBreached: boolean;
  errorMessage?: string;
}

/**
 * Authoritative Customer Tier & Category Discount Validator
 * Fixed Business Rules:
 * GOLD   -> Max 15.0%
 * SILVER -> Max 10.0%
 * BRONZE -> Max 5.0%
 */
export function validateCustomerTierDiscount(
  tier: CustomerTier,
  appliedDiscount: number
): DiscountValidationResult {
  const tierLimit = getCustomerTierMaxDiscount(tier);
  const remaining = Math.max(0, tierLimit - appliedDiscount);
  const isTierBreached = appliedDiscount > tierLimit + 0.001;

  if (isTierBreached) {
    return {
      isValid: false,
      tier,
      tierLimit,
      appliedDiscount,
      remainingCapacity: 0,
      isTierBreached: true,
      errorMessage: `Discount exceeds customer tier limit. ${tier} customers can receive a maximum discount of ${tierLimit.toFixed(0)}%.`,
    };
  }

  return {
    isValid: true,
    tier,
    tierLimit,
    appliedDiscount,
    remainingCapacity: Number(remaining.toFixed(1)),
    isTierBreached: false,
  };
}

export function evaluatePolicyCeilings(tier: CustomerTier, lines: LineItem[]): PolicyCheckResult[] {
  const tierLimit = getCustomerTierMaxDiscount(tier);

  return lines.map((line) => {
    const categoryLimit = CATEGORY_CEILINGS[line.category] ?? 10.0;
    const effectiveCeiling = Math.min(tierLimit, categoryLimit);
    const applied = line.discountPercent || 0;
    const excess = Math.max(0, applied - effectiveCeiling);
    const isBreached = excess > 0.001;
    const isTierBreached = applied > tierLimit + 0.001;

    let reasonCode: PolicyCheckResult['reasonCode'] = 'WITHIN_POLICY';
    let explanation = `Discount of ${applied.toFixed(1)}% is within the allowed ${tier} tier ceiling of ${effectiveCeiling.toFixed(1)}%.`;

    if (isTierBreached) {
      reasonCode = 'EXCEEDS_TIER_CAP';
      explanation = `Discount of ${applied.toFixed(1)}% exceeds the ${tier} customer tier ceiling of ${tierLimit.toFixed(1)}%. Maximum allowed is ${tierLimit.toFixed(1)}%.`;
    } else if (isBreached) {
      reasonCode = 'EXCEEDS_CATEGORY_CEILING';
      explanation = `${line.category} discount of ${applied.toFixed(1)}% exceeds the policy ceiling of ${effectiveCeiling.toFixed(1)}% by ${excess.toFixed(1)}%.`;
    }

    return {
      lineId: line.id,
      productName: line.name,
      category: line.category,
      appliedDiscount: applied,
      tierLimit,
      categoryLimit,
      effectiveCeiling,
      excessPercent: excess,
      isBreached,
      isTierBreached,
      reasonCode,
      explanation,
    };
  });
}
