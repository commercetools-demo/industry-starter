import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PromiseBar from '@/components/layout/PromiseBar';
import { renderWithIntl } from '@/test/render';

describe('PromiseBar', () => {
  it('renders threshold minutes and days', () => {
    renderWithIntl(
      <PromiseBar
        locale="en-US"
        figures={{ freeShippingThreshold: { centAmount: 7500, currencyCode: 'USD' }, collectionMinutes: 15, returnDays: 30 }}
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent(
      'Free shipping over $75.00 · Free café collection, ready in 15 min · 30-day returns',
    );
  });

  it('Threshold changes: the figure follows the data', () => {
    const { rerender } = renderWithIntl(
      <PromiseBar locale="en-US" figures={{ freeShippingThreshold: { centAmount: 7500, currencyCode: 'USD' }, collectionMinutes: null, returnDays: 30 }} />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('over $75.00');
    rerender(
      <PromiseBar locale="en-US" figures={{ freeShippingThreshold: { centAmount: 8000, currencyCode: 'USD' }, collectionMinutes: null, returnDays: 30 }} />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('over $80.00');
  });

  it('hides a clause when the figure is missing', () => {
    renderWithIntl(<PromiseBar locale="en-US" figures={{ freeShippingThreshold: null, collectionMinutes: null, returnDays: 30 }} />);
    const text = screen.getByRole('note').textContent ?? '';
    expect(text).toBe('30-day returns');
    expect(text).not.toMatch(/\{|undefined|null/);
  });

  it('Canada shows the CAD threshold and no collection clause', () => {
    renderWithIntl(
      <PromiseBar locale="en-CA" figures={{ freeShippingThreshold: { centAmount: 9900, currencyCode: 'CAD' }, collectionMinutes: null, returnDays: 30 }} />,
      { locale: 'en-CA' },
    );
    const text = screen.getByRole('note').textContent ?? '';
    expect(text).toContain('$99.00');
    expect(text).not.toMatch(/collection/i);
  });
});
