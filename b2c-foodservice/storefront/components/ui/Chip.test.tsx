import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Chip from './Chip';

describe('Chip', () => {
  it('Chip active sets aria-pressed', () => {
    const { rerender } = render(<Chip active>Beans</Chip>);
    expect(screen.getByRole('button', { name: 'Beans' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<Chip>Beans</Chip>);
    expect(screen.getByRole('button', { name: 'Beans' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Chip active uses ink fill', () => {
    render(<Chip active>Beans</Chip>);
    expect(screen.getByRole('button').className).toContain('bg-ink');
  });

  it('Chip hover uses the ink border', () => {
    render(<Chip>Beans</Chip>);
    expect(screen.getByRole('button').className).toContain('hover:border-ink');
  });
});
