// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderListPage, OrderView, ReturnEligibility, ReturnView } from '@/lib/types';

vi.mock('@/i18n/routing', async () => (await import('./test-support')).routingMock());
vi.mock('next/image', () => ({ default: () => null }));

import { InvoicePrint } from './InvoicePrint';
import { OrderDetail } from './OrderDetail';
import { OrderList } from './OrderList';
import { OverviewPanel } from './OverviewPanel';
import { PickupReadyNotice } from './PickupReadyNotice';
import { ReturnForm } from './ReturnForm';
import { ReturnList } from './ReturnList';
import { renderAccount, router, stubFetch } from './test-support';

const eur = (centAmount: number) => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const view = (over: Partial<OrderView> = {}): OrderView => ({
  id: 'o1',
  number: 'MA-ABCD2345',
  storeKey: 'mau-reseller-north',
  status: 'ready-for-pickup',
  mode: 'pickup',
  payment: 'paid',
  shippingMethodKey: 'mau-ship-pickup',
  email: 'anna@example.com',
  hasCustomer: true,
  lines: [{ id: 'l1', brand: 'Brembo', name: 'Brake pads', imageUrl: null, quantity: 2, total: eur(8000), recurrence: null }],
  totals: { subtotal: eur(8000), savings: [], delivery: eur(0), tax: { label: 'VAT (19%)', rate: 0.19, amount: eur(1277) }, total: eur(8000), pricesIncludeTax: true },
  pickup: { branchName: 'North Branch', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] }, timezone: 'Europe/Berlin' },
  shipTo: null,
  shipWindow: null,
  storeName: 'Malva North',
  subscription: null,
  timezone: 'Europe/Berlin',
  ...over,
});
const eligible: ReturnEligibility = { eligible: true, problem: null, deadline: '2026-11-10T00:00:00Z', lines: [{ lineItemId: 'l1', name: 'Brake pads', remaining: 2 }] };

beforeEach(() => {
  for (const fn of Object.values(router)) fn.mockReset();
  vi.unstubAllGlobals();
});

describe('OrderList', () => {
  const list = (over: Partial<OrderListPage> = {}): OrderListPage => ({
    items: [
      { number: 'MA-AAAA1111', createdAt: '2026-10-01T10:00:00Z', status: 'delivered', total: eur(11900), itemCount: 3 },
      { number: 'MA-BBBB2222', createdAt: '2026-09-01T10:00:00Z', status: 'cancelled', total: eur(500), itemCount: 1 },
    ],
    page: 1,
    pageSize: 10,
    total: 2,
    ...over,
  });
  it('OrderList renders status chips', async () => {
    const { container } = renderAccount(<OrderList store="mau-reseller-north" list={list()} />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View order MA-AAAA1111' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders/MA-AAAA1111');
    expect(screen.getByText(/119\.00/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
  it('pagination links', () => {
    renderAccount(<OrderList store="mau-reseller-north" list={list({ page: 2, total: 25 })} />);
    const nav = screen.getByRole('navigation', { name: 'Orders pages' });
    expect(within(nav).getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders');
    expect(within(nav).getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders?page=3');
    expect(within(nav).getByText('Page 2 of 3')).toBeInTheDocument();
  });
  it('no pagination for a single page', () => {
    renderAccount(<OrderList store="s" list={list()} />);
    expect(screen.queryByRole('navigation', { name: 'Orders pages' })).not.toBeInTheDocument();
  });
  it('empty state', () => {
    renderAccount(<OrderList store="mau-reseller-north" list={list({ items: [], total: 0 })} />);
    expect(screen.getByText('You have no orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse parts' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts');
  });
  it('de-DE', () => {
    renderAccount(<OrderList store="s" list={list()} />, 'de-DE');
    expect(screen.getByText('Zugestellt')).toBeInTheDocument();
  });
});

describe('OrderDetail', () => {
  it('OrderDetail shows pickup info', () => {
    renderAccount(<OrderDetail view={view()} store="mau-reseller-north" createdAt="2026-10-01T10:00:00Z" eligibility={{ eligible: false, problem: 'not-delivered', deadline: null, lines: [] }} returns={[]} />);
    expect(screen.getByText(/North Branch/)).toBeInTheDocument();
    expect(screen.getByText('Ready for pickup')).toBeInTheDocument();
    expect(screen.getByText('Paid online')).toBeInTheDocument();
  });
  it('OrderDetail shows invoice link', () => {
    renderAccount(<OrderDetail view={view()} store="mau-reseller-north" createdAt="2026-10-01T10:00:00Z" eligibility={eligible} returns={[]} />);
    expect(screen.getByRole('link', { name: 'Download invoice' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders/MA-ABCD2345/invoice');
  });
  it('the return button shows only when a return is possible, otherwise the reason', () => {
    const { unmount } = renderAccount(<OrderDetail view={view()} store="s" createdAt="2026-10-01T10:00:00Z" eligibility={eligible} returns={[]} />);
    expect(screen.getByRole('link', { name: 'Request a return' })).toHaveAttribute('href', '/en-US/s/account/orders/MA-ABCD2345/return');
    expect(screen.getByText(/You can request a return until/)).toBeInTheDocument();
    unmount();
    renderAccount(<OrderDetail view={view()} store="s" createdAt="2026-10-01T10:00:00Z" eligibility={{ eligible: false, problem: 'window-closed', deadline: '2026-09-01T00:00:00Z', lines: [] }} returns={[]} />);
    expect(screen.queryByRole('link', { name: 'Request a return' })).not.toBeInTheDocument();
    expect(screen.getByText('The return window for this order has closed.')).toBeInTheDocument();
  });
  it('reorder adds the lines and says how many', async () => {
    const calls = stubFetch({ 'POST /api/account/orders/MA-ABCD2345/reorder': { added: 1, skipped: 1, count: 4 } });
    renderAccount(<OrderDetail view={view()} store="mau-reseller-north" createdAt="2026-10-01T10:00:00Z" eligibility={eligible} returns={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Order again' }));
    expect(await screen.findByText('1 item was added to your cart.')).toBeInTheDocument();
    expect(screen.getByText('1 item could not be added because it is no longer available.')).toBeInTheDocument();
    expect(calls.map((c) => c.key)).toContain('POST /api/account/orders/MA-ABCD2345/reorder');
    expect(screen.getByRole('link', { name: 'View cart' })).toBeInTheDocument();
  });
  it('a failed reorder is announced', async () => {
    stubFetch({});
    renderAccount(<OrderDetail view={view()} store="s" createdAt="2026-10-01T10:00:00Z" eligibility={eligible} returns={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Order again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not add these items to your cart.');
  });
});

describe('InvoicePrint', () => {
  const seller = { name: 'Malva North', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' } };
  it('InvoicePrint shows tax label from order', () => {
    renderAccount(<InvoicePrint view={view()} store="s" createdAt="2026-10-01T10:00:00Z" seller={seller} buyer={{ name: 'Anna Schneider', email: 'anna@example.com' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice MA-ABCD2345' })).toBeInTheDocument();
    expect(screen.getByText('VAT (19%)')).toBeInTheDocument();
    expect(screen.getByText('Invoice reference: MA-ABCD2345', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Malva North')).toBeInTheDocument();
    expect(screen.getByText('Anna Schneider')).toBeInTheDocument();
  });
  it('the print button opens the print dialog', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderAccount(<InvoicePrint view={view()} store="s" createdAt="2026-10-01T10:00:00Z" seller={seller} buyer={{ name: null, email: null }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(print).toHaveBeenCalled();
  });
});

describe('ReturnForm', () => {
  const props = { store: 'mau-reseller-north', orderNumber: 'MA-ABCD2345', lines: eligible.lines, deadline: eligible.deadline, timeZone: 'Europe/Berlin' };
  it('needs at least one line', async () => {
    const calls = stubFetch({});
    renderAccount(<ReturnForm {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Request return' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one part.');
    expect(calls).toHaveLength(0);
  });
  it('reason required', async () => {
    const calls = stubFetch({});
    renderAccount(<ReturnForm {...props} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Return Brake pads' }));
    await userEvent.click(screen.getByRole('button', { name: 'Request return' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a reason.');
    expect(calls).toHaveLength(0);
  });
  it('shows tracking after success and sends the lines, quantity and reason', async () => {
    const calls = stubFetch({ 'POST /api/account/orders/MA-ABCD2345/return': { returnNumber: 'RET-MA-ABCD2345-1', tracking: 'RT-20261012-ABCDE' } });
    renderAccount(<ReturnForm {...props} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Return Brake pads' }));
    const quantity = screen.getByLabelText('Quantity for Brake pads');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '2');
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'wrong-fit');
    await userEvent.type(screen.getByLabelText('Comment (optional)'), 'too small');
    await userEvent.click(screen.getByRole('button', { name: 'Request return' }));
    expect(await screen.findByText('Return RT-20261012-ABCDE requested')).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({ key: 'POST /api/account/orders/MA-ABCD2345/return', body: { items: [{ lineItemId: 'l1', quantity: 2 }], reason: 'wrong-fit', comment: 'too small' } });
    expect(screen.getByRole('link', { name: 'View my returns' })).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });
  it('quantity is capped at what is left', async () => {
    stubFetch({});
    renderAccount(<ReturnForm {...props} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Return Brake pads' }));
    const quantity = screen.getByLabelText('Quantity for Brake pads') as HTMLInputElement;
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '9');
    expect(quantity.value).toBe('2');
  });
  it('a refusal of the server is shown in words', async () => {
    stubFetch({ 'POST /api/account/orders/MA-ABCD2345/return': new Response(JSON.stringify({ error: 'RETURN_WINDOW_CLOSED' }), { status: 409 }) });
    renderAccount(<ReturnForm {...props} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Return Brake pads' }));
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'defective');
    await userEvent.click(screen.getByRole('button', { name: 'Request return' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The return window for this order has closed.'));
  });
  it('axe clean in de-DE', async () => {
    stubFetch({});
    const { container } = renderAccount(<ReturnForm {...props} />, 'de-DE');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ReturnList', () => {
  const returns: ReturnView[] = [{ returnNumber: 'RET-MA-ABCD2345-1', tracking: 'RT-20261012-ABCDE', orderNumber: 'MA-ABCD2345', requestedAt: '2026-10-12T00:00:00Z', status: 'inspected', reason: 'wrong-fit', items: [{ lineItemId: 'l1', name: 'Brake pads', quantity: 2 }] }];
  it('lists returns with the portal status words and an order link', () => {
    renderAccount(<ReturnList store="mau-reseller-north" returns={returns} />);
    expect(screen.getByText('Inspected')).toBeInTheDocument();
    expect(screen.getByText('2 × Brake pads')).toBeInTheDocument();
    expect(screen.getByText('Reason: It does not fit my vehicle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Order MA-ABCD2345' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders/MA-ABCD2345');
  });
  it('empty state', () => {
    renderAccount(<ReturnList store="s" returns={[]} />);
    expect(screen.getByText('You have not requested a return.')).toBeInTheDocument();
  });
});

describe('OverviewPanel and the pickup notice', () => {
  const garage = { garage: { vehicles: [], activeId: null }, vehicles: [], active: null };
  const withVehicle = { garage: { vehicles: [], activeId: 'v1' }, vehicles: [{ id: 'v1', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI' }], active: { id: 'v1', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI' } };
  const latest = { number: 'MA-ABCD2345', createdAt: '2026-10-01T10:00:00Z', status: 'shipped' as const };

  it('greets by first name', async () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(<OverviewPanel store="s" firstName="Anna" latest={null} ready={[]} timeZone="Europe/Berlin" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Anna' })).toBeInTheDocument();
  });
  it('shows active vehicle', async () => {
    stubFetch({ 'GET /api/garage': withVehicle });
    renderAccount(<OverviewPanel store="s" firstName="Anna" latest={null} ready={[]} timeZone="Europe/Berlin" />);
    expect(await screen.findByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change vehicle' })).toBeInTheDocument();
  });
  it('no vehicle shows prompt to choose one', async () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(<OverviewPanel store="s" firstName={null} latest={null} ready={[]} timeZone="Europe/Berlin" />);
    expect(await screen.findByText('No vehicle selected yet. Choose one to see which parts fit.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose your vehicle' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });
  it('shows latest order status', () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(<OverviewPanel store="mau-reseller-north" firstName="Anna" latest={latest} ready={[]} timeZone="Europe/Berlin" />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en-US/mau-reseller-north/account/orders/MA-ABCD2345');
  });
  it('no orders invites to shop', () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(<OverviewPanel store="s" firstName="Anna" latest={null} ready={[]} timeZone="Europe/Berlin" />);
    expect(screen.getByText('You have not placed an order yet.')).toBeInTheDocument();
  });
  it('ready order shows top notice with store hours and number', () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(
      <OverviewPanel
        store="s"
        firstName="Anna"
        latest={{ ...latest, status: 'ready-for-pickup' }}
        ready={[{ orderNumber: 'MA-ABCD2345', storeName: 'North Branch', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] } }]}
        timeZone="Europe/Berlin"
      />,
    );
    const notice = screen.getByRole('region', { name: 'Order MA-ABCD2345 is ready for pickup' });
    expect(within(notice).getByText(/North Branch, Hauptstr\. 1, 10115 Berlin/)).toBeInTheDocument();
    expect(within(notice).getByLabelText('Opening hours')).toBeInTheDocument();
    expect(within(notice).getByText(/8.*AM.*6.*PM/)).toBeInTheDocument();
    expect(within(notice).getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en-US/s/account/orders/MA-ABCD2345');
  });
  it('no ready order shows no notice', () => {
    stubFetch({ 'GET /api/garage': garage });
    renderAccount(<OverviewPanel store="s" firstName="Anna" latest={latest} ready={[]} timeZone="Europe/Berlin" />);
    expect(screen.queryByText(/is ready for pickup/)).not.toBeInTheDocument();
  });
  it('the notice alone is accessible', async () => {
    const { container } = renderAccount(<PickupReadyNotice store="s" ready={{ orderNumber: 'MA-ABCD2345', storeName: 'North', address: null, hours: null }} />, 'de-DE');
    expect(await axe(container)).toHaveNoViolations();
  });
});
