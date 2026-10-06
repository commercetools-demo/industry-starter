import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cart } from '@/lib/types';
import { makeCart } from '@/test/cart';
import { renderWithProviders } from '@/test/utils';
import { CartSummary } from './CartSummary';

const address = { firstName: 'Ada', streetName: '1 Main', postalCode: '10001', city: 'NYC', country: 'US' };
const slot = { id: '20261012-10', start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T12:00:00.000Z', holdExpires: '2099-01-01T00:00:00.000Z' };
const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const render = (cart: Cart, onCheckout?: () => void) => renderWithProviders(<CartSummary cart={cart} onCheckout={onCheckout} />);

describe('CartSummary delivery', () => {
  it('shows the delivery price from the shipping method and the chosen slot under it', () => {
    render(makeCart({ shippingAddress: address, slot, shipping: { name: 'Standard delivery', price: usd(500), free: false } }));
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('Delivery slot: Mon, Oct 12, 10:00–12:00')).toBeInTheDocument();
  });

  it('free delivery reads "Included"', () => {
    render(makeCart({ shippingAddress: address, slot, shipping: { price: usd(0), free: true } }));
    expect(screen.getByText('Included')).toBeInTheDocument();
  });

  it('an expired slot is not shown', () => {
    render(makeCart({ shippingAddress: address, slot: { ...slot, holdExpires: '2020-01-01T00:00:00.000Z' } }));
    expect(screen.queryByText(/Delivery slot:/)).not.toBeInTheDocument();
  });
});

describe('CartSummary checkout rule', () => {
  it('no address: disabled, asks for an address', () => {
    render(makeCart(), vi.fn());
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Add a delivery address to continue.');
  });

  it('undeliverable address: disabled with the reason', () => {
    render(makeCart({ shippingAddress: { ...address, postalCode: '99999' } }), vi.fn());
    expect(screen.getByRole('button', { name: 'Checkout' })).toHaveAccessibleDescription('We do not deliver to this postcode yet.');
  });

  it('address but no slot: disabled, asks for a slot', () => {
    render(makeCart({ shippingAddress: address }), vi.fn());
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Choose a delivery slot to continue.');
  });

  it('address and slot: enabled and calls onCheckout', () => {
    const onCheckout = vi.fn();
    render(makeCart({ shippingAddress: address, slot }), onCheckout);
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onCheckout).toHaveBeenCalledOnce();
  });

  it('ready but no handler yet (V): stays disabled with the "opens soon" text', () => {
    render(makeCart({ shippingAddress: address, slot }));
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Checkout opens soon. Your bag is saved in the meantime.');
  });
});
