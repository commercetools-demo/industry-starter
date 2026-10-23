import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OrderSummary from '@/components/checkout/OrderSummary';
import StepIndicator from '@/components/checkout/StepIndicator';
import FieldError from '@/components/checkout/FieldError';
import { cad, usd, viewCart, viewLine } from '@/test/cart';
import { checkoutState } from '@/test/checkout';
import { expectNoAxeViolations } from '@/test/axe';
import { renderWithIntl } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

const ship = viewLine({ id: 'd', unitPrice: usd(2000) });
const collect = viewLine({ id: 'c', fulfilment: 'collect', unitPrice: usd(1000) });
const sub = viewLine({ id: 's', fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'p', schedule: { unit: 'Weeks', value: 2 } } });

describe('checkout summary (K-09)', () => {
  it('Summary is a projection of the last response', () => {
    const state = checkoutState(viewCart([ship], { shipping: { amount: usd(695), isFree: false }, tax: { amount: usd(216), included: false }, total: usd(2911) }));
    renderWithIntl(<OrderSummary state={state} />);
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('$29.11');
    const totals = screen.getByRole('heading', { name: '1 item' }).closest('section') as HTMLElement;
    expect(within(totals).getByText('Subtotal').nextSibling).toHaveTextContent('$20.00');
    expect(within(totals).getByText('Shipping').nextSibling).toHaveTextContent('$6.95');
    expect(within(totals).getByText('Tax').nextSibling).toHaveTextContent('$2.16');
  });
  it('Applied code pills are read from the cart', () => {
    const state = checkoutState(viewCart([ship]), {
      codes: [
        { code: 'WELCOME10', label: 'Welcome', state: 'applied', reason: null, savingCents: 200 },
        { code: 'COFFEE15', label: null, state: 'not_applicable', reason: 'DoesNotMatchCart', savingCents: null },
      ],
    });
    renderWithIntl(<OrderSummary state={state} />);
    expect(screen.getAllByTestId('code-pill').map((p) => p.textContent)).toEqual(['WELCOME10']);
    expect(screen.getByText("COFFEE15: Your bag doesn't meet this offer yet.")).toBeInTheDocument();
  });
  it('Discount row shows only above zero', () => {
    const none = checkoutState(viewCart([ship]));
    const { unmount } = renderWithIntl(<OrderSummary state={none} />);
    expect(screen.queryByText('Discount')).toBeNull();
    unmount();
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship], { discount: usd(300), subtotal: usd(1700) }))} />);
    expect(screen.getByText('Discount').nextSibling).toHaveTextContent('-$3.00');
  });
  it('Free shipping shows Free', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship], { shipping: { amount: usd(0), isFree: true } }))} />);
    expect(screen.getByText('Shipping').nextSibling).toHaveTextContent('Free');
  });
  it('Shipping says calculated in secure checkout before an address exists', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship], { shipping: null, tax: null, total: usd(2000) }))} />);
    expect(screen.getByText('Shipping').nextSibling).toHaveTextContent('Calculated in secure checkout');
    expect(screen.getByText('Tax').nextSibling).toHaveTextContent('Calculated in secure checkout');
  });
  it('Summary shows tax as its own row and no included-tax line', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship]))} />);
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.queryByText(/includes/i)).toBeNull();
  });
  it('Summary line list scrolls at 200px', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship, collect, sub]))} />);
    const list = screen.getByTestId('summary-lines');
    expect(list.className).toContain('max-h-[200px]');
    expect(list.className).toContain('overflow-y-auto');
  });
  it('Each summary line carries its fulfilment marker', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship, collect, sub]))} />);
    expect(screen.getAllByTestId('fulfilment-marker').map((m) => m.textContent)).toEqual(['Delivery', 'Collect at Malva SoHo', 'Every 2 weeks']);
  });
  it('Canadian amounts are shown in CAD', () => {
    renderWithIntl(<OrderSummary state={checkoutState(viewCart([viewLine({ id: 'd', unitPrice: cad(2000) })], { currency: 'CAD', country: 'CA', shipping: { amount: cad(895), isFree: false }, tax: { amount: cad(100), included: false }, total: cad(2995) }))} />, { locale: 'en-CA' });
    expect(screen.getByTestId('checkout-total').textContent).toContain('29.95');
  });
  it('has no accessibility violations', async () => {
    const { container } = renderWithIntl(<OrderSummary state={checkoutState(viewCart([ship, collect]))} />);
    await expectNoAxeViolations(container);
  });
});

describe('step indicator and field error', () => {
  const steps = [{ id: 1 as const, label: 'Review' }, { id: 2 as const, label: 'Pay' }];
  it('Going back: the done step is a button', async () => {
    const go = vi.fn();
    renderWithIntl(<StepIndicator steps={steps} current={2} onGoTo={go} />);
    await userEvent.click(screen.getByRole('button', { name: /Review/ }));
    expect(go).toHaveBeenCalledWith(1);
    expect(screen.getByRole('navigation', { name: 'Checkout steps' })).toBeInTheDocument();
    expect(screen.getByText('Pay').closest('li')).toHaveAttribute('aria-current', 'step');
  });
  it('Later stage is not clickable', () => {
    renderWithIntl(<StepIndicator steps={steps} current={1} onGoTo={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Pay').closest('span[aria-disabled]')).not.toBeNull();
    expect(screen.getByText('Review').closest('li')).toHaveAttribute('aria-current', 'step');
  });
  it('a field error is announced and has an id', () => {
    renderWithIntl(<FieldError id="e1">Enter the name of the person collecting.</FieldError>);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'e1');
  });
});
