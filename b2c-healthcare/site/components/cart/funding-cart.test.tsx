import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import type { Cart, CartLine, Money } from '@/lib/types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import { CartPage } from './CartPage';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const line = (id: string, name: string, owed: number, over: Partial<CartLine> = {}): CartLine => ({
  id,
  sku: `SKU-${id}`,
  name: { 'en-US': name },
  rxNumber: 'RX-77102',
  rxLineRef: `RX-77102-${id}`,
  prescribedQty: 30,
  unitPrice: usd(owed),
  totalPrice: usd(owed),
  priceUpdated: false,
  ...over,
});
const cartOf = (lines: CartLine[], over: Partial<Cart> = {}): Cart => ({
  id: 'c1', version: 1, itemCount: lines.length, lineCount: lines.length, currencyCode: 'USD', lines,
  subtotal: usd(1000), shipping: { name: 'Standard delivery', price: usd(0) }, total: usd(1000), unavailableCount: 0,
  ...over,
});

const PARTLY = line('1', 'Atorvastatin 20 mg tablets', 375, { cover: 'partly', coveredAmount: usd(1500), youOwe: usd(375) });
const FULL = line('2', 'Metformin 500 mg tablets', 0, { cover: 'covered', coveredAmount: usd(820), youOwe: usd(0) });
const NONE = line('3', 'Ibuprofen 400 mg tablets', 620, { cover: 'not-covered', coveredAmount: usd(0), youOwe: usd(620) });

let current: Cart | null;
beforeEach(() => {
  setPathname('/en-US/cart');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(current), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

async function show(cart: Cart) {
  current = cart;
  renderWithProviders(<CartPage />);
  await waitFor(() => expect(screen.queryByLabelText('Loading your cart')).toBeNull());
}

describe('payer-and-patient-cost-share: cart UI (U-04)', () => {
  it('Covered line shows both figures: what you owe and what the plan covers', async () => {
    await show(cartOf([PARTLY]));
    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText('You owe $3.75')).toBeInTheDocument();
    expect(within(row).getByText('Plan covers $15.00')).toBeInTheDocument();
    expect(row.querySelector('[data-cover="partly"]')).not.toBeNull();
  });

  it('Fully covered line: you owe nothing and it says so', async () => {
    await show(cartOf([FULL]));
    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText('You owe $0.00')).toBeInTheDocument();
    expect(within(row).getByText('Fully covered')).toBeInTheDocument();
  });

  it('Uncovered line in a covered basket: "Not covered" with the full price owed', async () => {
    await show(cartOf([PARTLY, NONE], { youOwe: usd(995), planCovers: usd(1500), total: usd(995) }));
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[1]!).getByText('Not covered')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('You owe $6.20')).toBeInTheDocument();
  });

  it('two totals: what you owe (the platform total) and what the plan covers', async () => {
    await show(cartOf([PARTLY, NONE], { youOwe: usd(995), planCovers: usd(1500), total: usd(995), subtotal: usd(995) }));
    const summary = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(summary).getByText('$15.00', { selector: '[data-plan-covers] b' })).toBeInTheDocument();
    expect(within(summary).getByText('You owe')).toBeInTheDocument();
    expect(within(summary).getByText('$9.95', { selector: '[data-total]' })).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('Resolver unavailable: "Cover unresolved" (not "Not covered"), no figures, Checkout disabled', async () => {
    const unresolved = line('1', 'Atorvastatin 20 mg tablets', 1875, { cover: 'unresolved' });
    await show(cartOf([unresolved], { unresolved: true }));
    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText('Cover unresolved')).toHaveAttribute('data-cover', 'unresolved');
    expect(within(row).queryByText('Not covered')).toBeNull();
    expect(within(row).queryByText('$18.75')).toBeNull();
    const summary = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(summary).getByText(/could not confirm what your plan covers/i)).toBeInTheDocument();
    expect(within(summary).queryByText('Total')).toBeNull();
    expect(within(summary).queryByRole('link', { name: 'Checkout' })).toBeNull();
    expect(within(summary).getByRole('button', { name: 'Cover unresolved' })).toBeDisabled();
  });

  it('a patient without a scheme sees the plain price and Total', async () => {
    await show(cartOf([line('1', 'Atorvastatin 20 mg tablets', 1875)], { total: usd(1875), subtotal: usd(1875) }));
    expect(screen.getByText('$18.75', { selector: '[data-line-price]' })).toBeInTheDocument();
    expect(screen.queryByText(/Plan covers/)).toBeNull();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});

describe('eligible-item-tender-restriction and benefit-allowance-drawdown: the cart shows the split before checkout (U-10)', () => {
  const withTender = (tender: NonNullable<Cart['tender']>) => cartOf([line('1', 'Atorvastatin 20 mg tablets', 1875), line('3', 'Alprazolam 0.5 mg tablets', 1260)], { total: usd(3135), subtotal: usd(3135), tender });

  it('Eligible subtotal shown on the basket: the qualifying subtotal and the amount needing another tender, before checkout', async () => {
    await show(withTender({ allowance: null, restricted: { available: true, eligibleSubtotal: usd(1875), applies: usd(1875), chosen: false }, card: usd(3135), needsOtherTender: usd(1260) }));
    const summary = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(summary).getByText('$18.75', { selector: '[data-eligible-subtotal]' })).toBeInTheDocument();
    expect(within(summary).getByText('$12.60', { selector: '[data-needs-other-tender]' })).toBeInTheDocument();
  });

  it('Balance visible before committing: the remaining balance, the amount this order would consume and the forfeit date', async () => {
    await show(withTender({ allowance: { balance: usd(5000), applies: usd(3135), forfeitsOn: '2026-11-01' }, restricted: { available: true, eligibleSubtotal: usd(1875), applies: usd(0), chosen: false }, card: usd(0), needsOtherTender: usd(1260) }));
    const summary = screen.getByRole('complementary', { name: 'Summary' });
    expect(within(summary).getByText('$50.00', { selector: '[data-allowance-balance]' })).toBeInTheDocument();
    expect(within(summary).getByText('$31.35', { selector: '[data-allowance-applies]' })).toBeInTheDocument();
    expect(within(summary).getByText(/forfeited on/i)).toBeInTheDocument();
    expect(within(summary).getByText('No card payment needed')).toBeInTheDocument();
  });

  it('Wholly ineligible basket: the reason is stated', async () => {
    await show(withTender({ allowance: null, restricted: { available: false, reason: 'none-eligible', eligibleSubtotal: usd(0), applies: usd(0), chosen: false }, card: usd(3135), needsOtherTender: usd(3135) }));
    expect(screen.getByText(/none of these items are eligible/)).toBeInTheDocument();
  });
});
