import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AvailabilityDot from './AvailabilityDot';

describe('AvailabilityDot', () => {
  it('AvailabilityDot has three states and a label when given', () => {
    const { container, rerender } = render(<AvailabilityDot state="in" />);
    expect(container.firstElementChild?.className).toContain('bg-teal');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<AvailabilityDot state="low" />);
    expect(container.firstElementChild?.className).toContain('bg-amber');
    rerender(<AvailabilityDot state="out" label="Out of stock" />);
    expect(container.firstElementChild?.className).toContain('bg-stone');
    expect(screen.getByRole('img', { name: 'Out of stock' })).toBeInTheDocument();
  });
});
