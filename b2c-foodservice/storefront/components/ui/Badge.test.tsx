import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('Badge variants ink and accent', () => {
    const { rerender } = render(<Badge>Bestseller</Badge>);
    expect(screen.getByText('Bestseller').className).toContain('bg-ink');
    rerender(<Badge variant="accent">New</Badge>);
    const b = screen.getByText('New');
    expect(b.className).toContain('bg-accent');
    expect(b.className).toContain('uppercase');
  });
});
