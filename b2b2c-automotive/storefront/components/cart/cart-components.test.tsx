// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GarageContext } from '@/context/GarageProvider';
import { CartProvider } from '@/context/CartProvider';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import type { GarageState } from '@/lib/types';
import { cart, eur, line, pickup, ship } from '@/test/cart-view-model';
import { installFakeApi, stateOf } from '@/test/vehicle';
import { CartLine } from './CartLine';
import { CartPage } from './CartPage';
import { DeliveryChoice } from './DeliveryChoice';
import { EmptyCart } from './EmptyCart';
import { FitWarning, LineFitBadge } from './FitWarning';
import { OrderSummary } from './OrderSummary';
import { PromoCodeForm } from './PromoCodeForm';
import { QuantityStepper } from './QuantityStepper';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mau-reseller-north/cart',
}));

afterEach(() => vi.unstubAllGlobals());

const emptyGarage: GarageState = { garage: { vehicles: [], activeId: null }, vehicles: [], active: null };
function renderCart(ui: ReactElement, { locale = 'en-US', garage = emptyGarage }: { locale?: 'en-US' | 'de-DE'; garage?: GarageState } = {}) {
  const messages = locale === 'de-DE' ? deMessages : enMessages;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback: { '/api/garage': garage } }}>
        <GarageContext.Provider value={{ lookupEnabled: false }}>{children}</GarageContext.Provider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}
const lineProps = { store: 'mau-reseller-north', onQuantity: vi.fn(), onRemove: vi.fn(), alternativesHref: '/mau-reseller-north/parts' };

describe('QuantityStepper', () => {
  it('stepper minimum 1', async () => {
    const onChange = vi.fn();
    renderCart(<QuantityStepper value={1} name="Brake pads" onChange={onChange} />);
    const minus = screen.getByRole('button', { name: 'Decrease quantity of Brake pads' });
    expect(minus).toBeDisabled();
    await userEvent.click(minus);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('stepper change calls action once', async () => {
    const onChange = vi.fn();
    renderCart(<QuantityStepper value={2} name="Brake pads" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Brake pads' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('CartLine', () => {
  it('CartLine shows image area, brand, name, stock, stepper, Remove and the line total', () => {
    renderCart(<ul><CartLine line={line()} {...lineProps} /></ul>);
    expect(screen.getByText('Brembo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Brake pads front' })).toHaveAttribute('href', '/en-US/mau-reseller-north/p/bremsbelag-vorn');
    expect(screen.getByText('In stock at Malva Berlin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Brake pads front from your cart' })).toBeInTheDocument();
    expect(screen.getByText('€92.00')).toBeInTheDocument();
    expect(screen.getByText('€100.00')).toBeInTheDocument();
  });
  it('CartLine shows stock split', () => {
    renderCart(<ul><CartLine line={line({ quantity: 8, stock: { fromStore: 5, shipsLater: 3, capped: false, available: 8, branchName: 'Malva Berlin' } })} {...lineProps} /></ul>);
    expect(screen.getByText('5 from Malva Berlin, 3 ships later')).toBeInTheDocument();
  });
  it('CartLine says ships later when nothing is at the branch', () => {
    renderCart(<ul><CartLine line={line({ quantity: 1, stock: { fromStore: 0, shipsLater: 1, capped: false, available: 1, branchName: 'Malva Berlin' } })} {...lineProps} /></ul>);
    expect(screen.getByText('Ships later')).toBeInTheDocument();
  });
  it('CartLine shows a capped quantity and an unavailable part', () => {
    const { rerender } = renderCart(<ul><CartLine line={line({ quantity: 9, stock: { fromStore: 2, shipsLater: 1, capped: true, available: 3, branchName: 'x' } })} {...lineProps} /></ul>);
    expect(screen.getByText('Only 3 available')).toBeInTheDocument();
    rerender(<ul><CartLine line={line({ stock: { fromStore: 0, shipsLater: 0, capped: true, available: 0, branchName: 'x' } })} {...lineProps} /></ul>);
    expect(screen.getByText('Currently not available')).toBeInTheDocument();
  });
  it('CartLine shows the subscription frequency', () => {
    renderCart(<ul><CartLine line={line({ recurrence: { policyKey: 'mau-rp-monthly', policyName: 'Every 3 months', priceMode: 'Dynamic' } })} {...lineProps} /></ul>);
    expect(screen.getByText('Delivery: Every 3 months')).toBeInTheDocument();
  });
  it('a one-time line shows no subscription chip', () => {
    renderCart(<ul><CartLine line={line()} {...lineProps} /></ul>);
    expect(screen.queryByText(/Delivery:/)).not.toBeInTheDocument();
  });
  it('Remove and the stepper call the actions with the line id', async () => {
    const onQuantity = vi.fn();
    const onRemove = vi.fn();
    renderCart(<ul><CartLine line={line()} {...lineProps} onQuantity={onQuantity} onRemove={onRemove} /></ul>);
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Brake pads front' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Brake pads front from your cart' }));
    expect(onQuantity).toHaveBeenCalledWith('li-1', 3);
    expect(onRemove).toHaveBeenCalledWith('li-1');
  });
  it('the live region announces the new quantity and total', () => {
    renderCart(<ul><CartLine line={line()} {...lineProps} /></ul>);
    expect(screen.getByText('Brake pads front: quantity 2, line total €92.00')).toBeInTheDocument();
  });
  it('a line that does not fit the vehicle gets the danger badge and alternatives, but nothing is disabled', () => {
    renderCart(<ul><CartLine line={line()} fit="does-not-fit" vehicleLabel="2022 Volkswagen Golf" {...lineProps} /></ul>);
    expect(screen.getByText(/May not fit your 2022 Volkswagen Golf/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View fitting alternatives' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity of Brake pads front' })).toBeEnabled();
  });
  it('an unpriced line says so', () => {
    renderCart(<ul><CartLine line={line()} unpriced {...lineProps} /></ul>);
    expect(screen.getByRole('alert')).toHaveTextContent('No price for this part at your store');
  });
});

describe('DeliveryChoice', () => {
  it('DeliveryChoice pickup shows Free and store', () => {
    renderCart(<DeliveryChoice options={[pickup, ship]} selected="pickup" onSelect={vi.fn()} />);
    expect(screen.getByText('Pick up · Free')).toBeInTheDocument();
    expect(screen.getByText('Malva Berlin, Berlin · Pickup today')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Pick up/ })).toBeChecked();
  });
  it('DeliveryChoice ship below threshold shows remaining', () => {
    renderCart(<DeliveryChoice options={[pickup, ship]} selected="ship" onSelect={vi.fn()} />);
    expect(screen.getByText('Ship to me · €5.90')).toBeInTheDocument();
    expect(screen.getByText('Add €48.50 more for free shipping')).toBeInTheDocument();
  });
  it('ship at or above the threshold reads Free over {threshold}', () => {
    renderCart(<DeliveryChoice options={[pickup, { ...ship, fee: eur(0), remainingForFree: null }]} selected="ship" onSelect={vi.fn()} />);
    expect(screen.getByText('Ship to me · Free')).toBeInTheDocument();
    expect(screen.getByText('Free over €150.00')).toBeInTheDocument();
  });
  it('selecting an option calls onSelect', async () => {
    const onSelect = vi.fn();
    renderCart(<DeliveryChoice options={[pickup, ship]} selected="pickup" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('radio', { name: /Ship to me/ }));
    expect(onSelect).toHaveBeenCalledWith('ship');
  });
  it('no matching method shows a plain notice, not a crash', () => {
    renderCart(<DeliveryChoice options={[]} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('No delivery option available.');
  });
});

describe('PromoCodeForm', () => {
  it('PromoCodeForm applies a typed code', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    renderCart(<PromoCodeForm codes={[]} onApply={onApply} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Promo code'), ' MALVA-WELCOME5 ');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('MALVA-WELCOME5');
  });
  it('an applied code shows Applied and Remove', async () => {
    const onRemove = vi.fn();
    renderCart(<PromoCodeForm codes={[{ code: 'MALVA-WELCOME5', id: 'dc-1', state: 'applied', reason: null }]} onApply={vi.fn()} onRemove={onRemove} />);
    expect(screen.getByRole('status')).toHaveTextContent('✓ Applied');
    await userEvent.click(screen.getByRole('button', { name: 'Remove code MALVA-WELCOME5' }));
    expect(onRemove).toHaveBeenCalledWith('dc-1');
  });
  it('PromoCodeForm not applied shows reason and remove', async () => {
    const onRemove = vi.fn();
    renderCart(<PromoCodeForm codes={[{ code: 'SUEDKAMM-BRAKE5', id: 'dc-2', state: 'not-applied', reason: 'does-not-match' }]} onApply={vi.fn()} onRemove={onRemove} />);
    expect(screen.getByRole('status')).toHaveTextContent('✕ Not applied');
    expect(screen.getByText('This code does not apply to the items in your cart.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove code SUEDKAMM-BRAKE5' }));
    expect(onRemove).toHaveBeenCalledWith('dc-2');
  });
  it('a refused code is listed from the response and can be dismissed', async () => {
    const rejected = { code: 'NONSENSE', id: '', state: 'not-applied' as const, reason: 'not-valid' as const };
    renderCart(<PromoCodeForm codes={[]} rejected={rejected} onApply={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('This code is not valid.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove code NONSENSE' }));
    expect(screen.queryByText('NONSENSE')).not.toBeInTheDocument();
  });
});

describe('OrderSummary', () => {
  const props = { hasSubscription: false, checkoutHref: '/mau-reseller-north/checkout' };
  it('OrderSummary lists each saving by name', () => {
    renderCart(<OrderSummary totals={cart().totals} {...props} />);
    expect(screen.getByText('Brake week −8%')).toBeInTheDocument();
    expect(screen.getByText('−€8.00')).toBeInTheDocument();
    expect(screen.getByText('Welcome −5%')).toBeInTheDocument();
    expect(screen.getByText('−€0.50')).toBeInTheDocument();
  });
  it('OrderSummary tax label from props', () => {
    renderCart(<OrderSummary totals={cart().totals} {...props} />);
    expect(screen.getByText('VAT (19%)')).toBeInTheDocument();
    expect(screen.getByText('€16.20')).toBeInTheDocument();
    expect(screen.getByText('€101.50')).toBeInTheDocument();
    expect(screen.queryByText('HST')).not.toBeInTheDocument();
  });
  it('a missing tax calculation reads Calculated at checkout', () => {
    renderCart(<OrderSummary totals={{ ...cart().totals, tax: null }} {...props} />);
    expect(screen.getByText('Calculated at checkout')).toBeInTheDocument();
  });
  it('a tax without a label falls back to Tax and the rate', () => {
    renderCart(<OrderSummary totals={{ ...cart().totals, tax: { label: '', rate: 0.07, amount: eur(100) } }} {...props} />);
    expect(screen.getByText('Tax (7%)')).toBeInTheDocument();
  });
  it('delivery reads Free for zero and the fee otherwise', () => {
    const { rerender } = renderCart(<OrderSummary totals={cart().totals} {...props} />);
    const row = () => screen.getByText('Delivery').parentElement as HTMLElement;
    expect(within(row()).getByText('Free')).toBeInTheDocument();
    rerender(<OrderSummary totals={{ ...cart().totals, delivery: eur(590) }} {...props} />);
    expect(within(row()).getByText('€5.90')).toBeInTheDocument();
  });
  it('OrderSummary shows the renewal note only for subscriptions', () => {
    const { rerender } = renderCart(<OrderSummary totals={cart().totals} {...props} />);
    expect(screen.queryByText(/renew automatically/)).not.toBeInTheDocument();
    rerender(<OrderSummary totals={cart().totals} {...props} hasSubscription />);
    expect(screen.getByText('Subscription items renew automatically. Manage them in your account.')).toBeInTheDocument();
  });
  it('Checkout is a link, disabled with a reason while a line is out of stock', () => {
    const { rerender } = renderCart(<OrderSummary totals={cart().totals} {...props} />);
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en-US/mau-reseller-north/checkout');
    rerender(<OrderSummary totals={cart().totals} {...props} checkoutBlocked />);
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Remove the parts that are not available');
  });
});

describe('EmptyCart', () => {
  it('EmptyCart hides summary', () => {
    renderCart(
      <CartProvider initialCart={null}>
        <CartPage store="mau-reseller-north" />
      </CartProvider>,
    );
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse parts' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
    expect(screen.queryByText('Order summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument();
  });
  it('EmptyCart renders on its own', () => {
    renderCart(<EmptyCart browseHref="/s/parts" />);
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });
});

describe('FitWarning', () => {
  it('uses locked danger tokens and glyph', () => {
    renderCart(<FitWarning count={2} vehicle="2022 Volkswagen Golf" alternativesHref="/s/parts" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('✕ 2 items may not fit your 2022 Volkswagen Golf');
    expect(banner.className).toContain('bg-danger-50');
    expect(banner.className).toContain('text-danger-600');
    expect(screen.getByRole('link', { name: 'View fitting alternatives' })).toBeInTheDocument();
  });
  it('one item reads singular and none renders nothing', () => {
    const { container, rerender } = renderCart(<FitWarning count={1} vehicle="V" alternativesHref="/s" />);
    expect(screen.getByRole('status')).toHaveTextContent('1 item may not fit your V');
    rerender(<FitWarning count={0} vehicle="V" alternativesHref="/s" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('the line badge uses the danger tint', () => {
    renderCart(<LineFitBadge vehicle="V" />);
    expect(screen.getByText(/May not fit your V/).closest('span')?.className).toContain('bg-danger-50');
  });
});

describe('CartPage', () => {
  const full = () => (
    <CartProvider initialCart={cart()}>
      <CartPage store="mau-reseller-north" />
    </CartProvider>
  );
  it('shows lines, delivery, promo and summary', () => {
    renderCart(full());
    expect(screen.getByRole('heading', { level: 1, name: 'Your cart' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Pick up/ })).toBeChecked();
    expect(screen.getByLabelText('Promo code')).toBeInTheDocument();
    expect(screen.getByText('Order summary')).toBeInTheDocument();
  });
  it('the layout is one column below 680 and three above (class assertions)', () => {
    renderCart(full());
    const grid = screen.getByRole('list', { name: 'Items in your cart' }).parentElement?.parentElement as HTMLElement;
    expect(grid.className).toContain('min-[42.5rem]:grid-cols-3');
    expect(grid.className).not.toMatch(/(^| )grid-cols-/);
  });
  it('CartPage one column at 375: no fixed widths on the page frame', () => {
    renderCart(full());
    expect(screen.getByRole('heading', { level: 1 }).parentElement?.className).not.toMatch(/\bw-\d|min-w-\[/);
  });
  it('a vehicle that a line does not fit shows the banner and badge and keeps Checkout enabled', async () => {
    installFakeApi(stateOf('volkswagen.golf.2022.2-0-tdi'));
    renderCart(full(), { garage: stateOf('volkswagen.golf.2022.2-0-tdi') });
    expect(await screen.findByText(/items? may not fit your/)).toBeInTheDocument();
    expect(screen.getAllByText(/May not fit your/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
  });
  it('no vehicle means no warning', () => {
    renderCart(full());
    expect(screen.queryByText(/may not fit/i)).not.toBeInTheDocument();
  });
  it('Checkout is disabled when a line is out of stock', () => {
    const blocked = cart({ lines: [line({ stock: { fromStore: 0, shipsLater: 0, capped: true, available: 0, branchName: 'x' } })] });
    renderCart(
      <CartProvider initialCart={blocked}>
        <CartPage store="mau-reseller-north" />
      </CartProvider>,
    );
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
  });
  it('CartPage has no axe violations in de-DE and en-US', async () => {
    const en = renderCart(full(), { locale: 'en-US' });
    expect(await axe(en.container)).toHaveNoViolations();
    en.unmount();
    const de = renderCart(full(), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Ihr Warenkorb' })).toBeInTheDocument();
    expect(await axe(de.container)).toHaveNoViolations();
  });
  it('the German page formats money and the tax label for the German store', () => {
    renderCart(full(), { locale: 'de-DE' });
    expect(screen.getByText('101,50 €')).toBeInTheDocument();
    expect(screen.getByText('Zwischensumme')).toBeInTheDocument();
    expect(screen.getByText('Abholen · Kostenlos')).toBeInTheDocument();
  });
  it('an action failure shows the error banner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    renderCart(full());
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity of Brake pads front' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We could not update your cart.'));
  });
});
