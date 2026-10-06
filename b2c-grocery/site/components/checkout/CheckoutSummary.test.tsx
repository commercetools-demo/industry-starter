import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cartLine, makeCart } from '@/test/cart';
import { renderWithProviders } from '@/test/utils';
import { CheckoutSummary } from './CheckoutSummary';

const slot = { id: '20261013-10', start: '2026-10-13T10:00:00.000Z', end: '2026-10-13T12:00:00.000Z' };

describe('CheckoutSummary', () => {
  it('lists the lines with quantities, delivery, slot and the server total', () => {
    const cart = makeCart({
      lines: [cartLine({ name: 'Bananas', quantity: 2, total: { centAmount: 400, currencyCode: 'USD' } })],
      shipping: { price: { centAmount: 500, currencyCode: 'USD' }, free: false },
      slot,
      total: { centAmount: 900, currencyCode: 'USD' },
    });
    renderWithProviders(<CheckoutSummary cart={cart} />);
    expect(screen.getByText('Bananas')).toBeInTheDocument();
    expect(screen.getByText(/× 2/)).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('$9.00')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-slot')).toHaveTextContent(/10:00–12:00/);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByTestId('provisional-note')).toBeNull();
  });

  it('Weighed item in bag: provisional total label and note', () => {
    renderWithProviders(<CheckoutSummary cart={makeCart({ isProvisional: true })} />);
    expect(screen.getByText('Total (provisional)')).toBeInTheDocument();
    expect(screen.getByTestId('provisional-note')).toBeInTheDocument();
  });

  it('free delivery reads Included', () => {
    renderWithProviders(<CheckoutSummary cart={makeCart({ shipping: { price: { centAmount: 0, currencyCode: 'USD' }, free: true } })} />);
    expect(screen.getByText('Included')).toBeInTheDocument();
  });
});
