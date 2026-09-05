import { describe, it, expect } from 'vitest';
import { formatMoney, formatPct, formatRelativeDate, formatAbsoluteDate } from '../../src/lib/format';

describe('format utilities', () => {
  it('formats money with Indian Rupee defaults and custom currency', () => {
    expect(formatMoney(558000, 'INR')).toContain('5,58,000');
    expect(formatMoney(1200.5, 'USD')).toContain('1,200.50');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('formats percentage with 1 decimal place', () => {
    expect(formatPct(19.34)).toBe('19.3%');
    expect(formatPct(8)).toBe('8.0%');
    expect(formatPct(null)).toBe('0.0%');
  });

  it('formats dates safely', () => {
    expect(formatRelativeDate(null)).toBe('—');
    expect(formatAbsoluteDate(null)).toBe('—');
    const iso = new Date(Date.now() - 60000).toISOString();
    expect(formatRelativeDate(iso)).toContain('ago');
  });
});
