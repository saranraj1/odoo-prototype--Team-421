import { format, formatDistanceToNow } from 'date-fns';

export function formatMoney(amount: number | string | null | undefined, currency: string = 'INR'): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '—';
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0.0%';
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toFixed(1)}%`;
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatAbsoluteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return format(d, 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}
