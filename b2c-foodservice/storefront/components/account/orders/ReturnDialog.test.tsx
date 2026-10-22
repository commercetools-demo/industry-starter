import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import OrderDetail from '@/components/account/orders/OrderDetail';
import ReturnDialog from '@/components/account/orders/ReturnDialog';
import { orderView } from '@/test/checkout';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { OrderView } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const order = (over: Partial<OrderView> = {}): OrderView =>
  orderView({
    id: 'o1', orderNumber: 'MC-1001', customerId: 'c1', createdAt: '2026-10-01T10:00:00.000Z', currency: 'USD', status: 'completed',
    state: null, shipmentState: 'Delivered', paymentState: 'Paid', hasCollect: false, hasShip: true,
    lines: [
    { id: 'l1', sku: 'S1', name: 'Ember pods', variantSummary: '', imageUrl: null, quantity: 3, unitCents: 1000, priceCents: 3000, fulfilment: 'delivery', storeKey: null, storeName: null, recurrence: null },
    { id: 'l2', sku: 'S2', name: 'Casa pods', variantSummary: '', imageUrl: null, quantity: 1, unitCents: 1500, priceCents: 1500, fulfilment: 'delivery', storeKey: null, storeName: null, recurrence: null },
  ],
    ship: null,
    totals: { subtotalCents: 4500, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 4500 },
    canReturn: true, returnWindowEndsAt: '2026-11-01T00:00:00.000Z', returnable: { l1: 3, l2: 1 },
    ...over,
  });

beforeEach(() => {
  nav.pathname = '/account/orders/MC-1001';
});
afterEach(() => vi.unstubAllGlobals());

describe('ReturnDialog', () => {
  it('the line checkboxes are 24 px targets (WCAG 2.5.8)', () => {
    renderShell(<ReturnDialog order={order()} open onClose={() => {}} onSubmit={vi.fn()} />);
    for (const box of within(screen.getByRole('dialog')).getAllByRole('checkbox')) {
      expect(box.className).toMatch(/\bh-6\b/);
      expect(box.className).toMatch(/\bw-6\b/);
    }
  });

  it('Return dialog needs at least one item and a quantity within range', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderShell(<ReturnDialog order={order()} open onClose={() => {}} onSubmit={onSubmit} />);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start return' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choose at least one item.');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Ember pods' }));
    const qty = within(dialog).getByLabelText('Quantity to return of Ember pods') as HTMLSelectElement;
    expect([...qty.options].map((o) => o.value)).toEqual(['1', '2', '3']);
    await userEvent.selectOptions(qty, '2');
    await userEvent.selectOptions(within(dialog).getByLabelText('Reason'), 'damaged');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start return' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ lineId: 'l1', quantity: 2, reason: 'damaged' }]));
  });

  it('only lines with units left are offered', () => {
    renderShell(<ReturnDialog order={order({ returnable: { l1: 0, l2: 1 } })} open onClose={() => {}} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: 'Ember pods' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Casa pods' })).toBeInTheDocument();
  });

  it('a failed return keeps the dialog open with a message', async () => {
    const onClose = vi.fn();
    renderShell(<ReturnDialog order={order()} open onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error('x'))} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Casa pods' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start return' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not start the return');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Returns on the order detail', () => {
  const render = (o: OrderView, routes: Record<string, () => unknown> = {}) => {
    stubFetch({ '/api/auth/me': () => ({ customer }), ...routes });
    return renderShell(<OrderDetail orderId="o1" orderNumber="MC-1001" initial={o} />);
  };

  it('offers Start a return inside the window and posts the lines', async () => {
    const next = order({
      returns: [{ id: 'return-1', createdAt: '2026-10-05T00:00:00.000Z', trackingId: null, items: [
        { id: 'r1', lineId: 'l2', name: 'Casa pods', quantity: 1, reason: null, shipmentState: 'Advised', paymentState: 'Initial' },
      ] }],
      returnable: { l1: 3, l2: 0 },
    });
    render(order(), { '/api/orders/o1/returns': () => ({ order: next }) });
    await userEvent.click(screen.getByRole('button', { name: 'Start a return' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Casa pods' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start return' }));
    await waitFor(() => expect(screen.getByTestId('return')).toBeInTheDocument());
    expect(screen.getByTestId('return-goods-chip')).toHaveTextContent('Return announced');
  });

  it('after the window it says so and offers no button', () => {
    render(order({ canReturn: false, returnWindowEndsAt: null }));
    expect(screen.queryByRole('button', { name: 'Start a return' })).toBeNull();
    expect(screen.getByTestId('return-closed')).toHaveTextContent('The return window for this order has closed.');
  });

  it('an order still on its way shows no returns section', () => {
    render(order({ status: 'shipped', canReturn: false }));
    expect(screen.queryByRole('button', { name: 'Start a return' })).toBeNull();
    expect(screen.queryByTestId('return-closed')).toBeNull();
  });
});
