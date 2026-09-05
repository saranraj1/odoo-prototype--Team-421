import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RiskBadge } from '../../src/components/data/RiskBadge';

describe('RiskBadge', () => {
  it('renders HIGH danger badge when score is 56.0', () => {
    render(<RiskBadge score={56.0} showSeverityText />);
    expect(screen.getByText('56.0')).toBeInTheDocument();
    expect(screen.getByText('(HIGH)')).toBeInTheDocument();
  });

  it('renders MEDIUM warning badge when score is 29.7', () => {
    render(<RiskBadge score={29.7} showSeverityText />);
    expect(screen.getByText('29.7')).toBeInTheDocument();
    expect(screen.getByText('(MEDIUM)')).toBeInTheDocument();
  });

  it('renders LOW success badge when score is 8.0', () => {
    render(<RiskBadge score={8.0} severity="LOW" showSeverityText />);
    expect(screen.getByText('8.0')).toBeInTheDocument();
    expect(screen.getByText('(LOW)')).toBeInTheDocument();
  });
});
