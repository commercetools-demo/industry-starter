import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TokenSwatches } from './TokenSwatches';

describe('TokenSwatches', () => {
  it('renders the color scales, type scale, radii, shadows and status badges', () => {
    const { container } = render(<TokenSwatches />);
    for (const scale of ['brand', 'navy', 'neutral', 'status']) {
      expect(container.querySelector(`[data-scale="${scale}"]`)).not.toBeNull();
    }
    expect(screen.getByText('--color-brand-500')).toBeInTheDocument();
    expect(screen.getByText('--color-neutral-0')).toBeInTheDocument();
    expect(screen.getByText('--color-danger-700')).toBeInTheDocument();
    expect(screen.getByText('--font-meta')).toBeInTheDocument();
    expect(screen.getByText('--text-4xl')).toBeInTheDocument();
    expect(screen.getByText('--radius-pill')).toBeInTheDocument();
    expect(screen.getByText('--shadow-lg')).toBeInTheDocument();
  });

  it('paints swatches through the tokens', () => {
    const { container } = render(<TokenSwatches />);
    const swatch = container.querySelector('[data-scale="brand"] li span');
    expect(swatch).toHaveStyle({ background: 'var(--color-brand-50)' });
  });

  it('Status text meets contrast: each badge uses its -700 text on its -50 background', () => {
    render(<TokenSwatches />);
    const badges = within(screen.getByTestId('status-badges')).getAllByRole('listitem');
    expect(badges).toHaveLength(4);
    for (const badge of badges) {
      const s = badge.getAttribute('data-status');
      expect(badge).toHaveStyle({ background: `var(--color-${s}-50)`, color: `var(--color-${s}-700)` });
    }
  });

  it('Primary button label: shows the navy label next to the white label on azure, both real buttons', () => {
    const { container } = render(<TokenSwatches />);
    const [navy, white] = screen.getAllByRole('button', { name: 'Book appointment' });
    expect(navy).toHaveAttribute('data-label', 'navy');
    expect(navy).toHaveStyle({ background: 'var(--color-action)', color: 'var(--color-action-label)' });
    expect(white).toHaveStyle({ background: 'var(--color-action)', color: 'var(--color-text-on-brand)' });
    expect(container.querySelectorAll('div[onclick], [role="button"]')).toHaveLength(0);
  });
});
