import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusChip } from '../../src/components/data/StatusChip';

describe('StatusChip', () => {
  it('renders human-friendly labels for approval states', () => {
    render(<StatusChip status="PENDING_MANAGER" />);
    expect(screen.getByText('Pending: Sales Manager')).toBeInTheDocument();
  });

  it('renders auto-approved badge for EVALUATED_NO_APPROVAL', () => {
    render(<StatusChip status="EVALUATED_NO_APPROVAL" />);
    expect(screen.getByText('Auto-Approved')).toBeInTheDocument();
  });

  it('renders invalidated badge in danger styling', () => {
    render(<StatusChip status="INVALIDATED" />);
    expect(screen.getByText('Invalidated')).toBeInTheDocument();
  });

  it('renders fallback for null status', () => {
    render(<StatusChip status={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
