import { describe, it, expect } from 'vitest';

const FORBIDDEN_KEY_PATTERN = /(cost|margin|risk|ceiling|overage|approval|approver)/i;

function sanitizePortalPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((i) => sanitizePortalPayload(i));

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      continue;
    }
    sanitized[key] = sanitizePortalPayload(val);
  }
  return sanitized;
}

describe('Portal Zero-Leakage Whitelist Assertion', () => {
  it('strictly strips forbidden internal keys from portal payload', () => {
    const rawBackendPayload = {
      id: 'deal_123',
      number: 'D-1024',
      portal_status: 'UNDER_NEGOTIATION',
      lines: [
        {
          product_name: 'Setup Service',
          qty: 1,
          price_unit: 100000,
          discount_pct: 18,
          cost_price: 80000, // FORBIDDEN
          margin: 2000,       // FORBIDDEN
          ceiling_pct: 10,    // FORBIDDEN
          overage_pts: 8,     // FORBIDDEN
        },
      ],
      current_risk_score: 56.0, // FORBIDDEN
      required_level: 'MANAGER_AND_FINANCE',
      approval_state: 'PENDING_MANAGER', // FORBIDDEN
    };

    const sanitized = sanitizePortalPayload(rawBackendPayload);

    expect(sanitized.id).toBe('deal_123');
    expect(sanitized.number).toBe('D-1024');
    expect(sanitized.portal_status).toBe('UNDER_NEGOTIATION');

    // Assert internal forbidden keys are strictly deleted
    expect(sanitized).not.toHaveProperty('current_risk_score');
    expect(sanitized).not.toHaveProperty('approval_state');
    expect(sanitized.lines[0]).not.toHaveProperty('cost_price');
    expect(sanitized.lines[0]).not.toHaveProperty('margin');
    expect(sanitized.lines[0]).not.toHaveProperty('ceiling_pct');
    expect(sanitized.lines[0]).not.toHaveProperty('overage_pts');
  });
});
