/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerProvider } from '@/context/ViewerContext';
import { berlinHour, greetingKey } from '@/lib/dashboard/greeting';
import type { Viewer } from '@/lib/portal/types';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { Dashboard } from './Dashboard';
import { DashboardHeader } from './DashboardHeader';

const viewer = (roles: Viewer['roles']): Viewer => ({
  customerId: 'cust-1',
  name: 'Anna Test',
  email: 'anna@example.com',
  roles,
  ctPermissions: [],
  businessUnitKey: 'bu-1',
  businessUnitName: 'Test Garage Nord',
  storeKey: 'store-1',
  storeName: 'DACH Online',
});

const money = (centAmount: number) => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const order = (n: number, chip: string) => ({ id: `o${n}`, orderNumber: `ORD-${n}`, createdAt: '2026-10-10T10:00:00.000Z', customer: 'Anna T.', total: money(12345), chip });

const BODIES: Record<string, unknown> = {
  '/api/seller/dashboard/recent-orders': { orders: [order(1, 'shipped'), order(2, 'processing'), order(3, 'payment-pending'), order(4, 'cancelled')], openCount: 7 },
  '/api/seller/dashboard/kpis': { openReturns: 2, activeSubscriptions: 5, unansweredReviews: 3 },
  '/api/seller/dashboard/returns': [{ id: 'r1', returnNumber: 'RET-1', orderNumber: 'ORD-9', customer: 'Mia R.', items: [{ quantity: 2, name: { 'en-US': 'Brake pad' } }], status: 'requested' }],
  '/api/seller/dashboard/stock': [{ branch: { key: 'b1', name: { 'en-US': 'Branch Hamburg' } }, parts: [{ sku: 'S1', name: { 'en-US': 'Oil filter' }, available: 2 }] }],
  '/api/seller/dashboard/renewals': [{ id: 'ro1', nextOrderAt: '2026-10-14T00:00:00.000Z', name: { 'en-US': 'Wiper blades' }, itemCount: 2 }],
  '/api/seller/dashboard/heads-up': { kind: 'out-of-stock-everywhere', count: 3, href: '/catalog?tab=assortment&stock=none' },
  '/api/seller/dashboard/store-performance': {
    currency: 'EUR',
    periodDays: 30,
    sales: money(150000),
    orders: 12,
    averageOrder: money(12500),
    topProducts: [{ sku: 'S1', name: { 'en-US': 'Oil filter' }, units: 4, revenue: money(50000) }],
    daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, sales: i * 100 })),
    truncated: false,
  },
};

let overrides: Record<string, () => Response> = {};
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input), 'http://localhost');
  const override = overrides[url.pathname];
  if (override) return override();
  return Response.json(BODIES[url.pathname] ?? {});
});
const down = () => Response.json({ error: 'unavailable' }, { status: 502 });
const requested = () => fetchMock.mock.calls.map((c) => new URL(String(c[0]), 'http://localhost').pathname);

beforeEach(() => {
  overrides = {};
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

const renderDashboard = (roles: Viewer['roles'] = ['admin'], locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(
    <ViewerProvider viewer={viewer(roles)}>
      <Dashboard />
    </ViewerProvider>,
    { locale, messages: locale === 'en-US' ? en : de },
  );

const ORDERS_ERROR = "We couldn't load your store orders. The rest of your dashboard is unaffected.";

describe('Dashboard widgets', () => {
  it('shows loading placeholders first, then every widget with data', async () => {
    renderDashboard();
    expect(screen.getAllByTestId('widget-loading').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('kpi-open-orders-value')).toHaveTextContent('7'));
    expect(screen.getByTestId('kpi-open-returns-value')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-active-subscriptions-value')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-unanswered-reviews-value')).toHaveTextContent('3');
    expect(await screen.findByText('RET-1')).toBeInTheDocument();
    expect(await screen.findByText('Branch Hamburg')).toBeInTheDocument();
    expect(await screen.findByText('Wiper blades')).toBeInTheDocument();
    expect(await screen.findByText('3 parts in your assortment are out of stock in every branch.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('widget-loading')).toHaveLength(0);
  });

  it('orders down: Open orders KPI reads Unavailable, orders widget shows the exact message with Retry, other widgets render normally', async () => {
    overrides['/api/seller/dashboard/recent-orders'] = down;
    renderDashboard();
    const widget = await screen.findByTestId('widget-orders');
    await within(widget).findByText('Orders unavailable');
    expect(within(widget).getByText(ORDERS_ERROR)).toBeInTheDocument();
    expect(within(widget).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByTestId('kpi-open-orders-value')).toHaveTextContent('Unavailable');
    expect(await screen.findByText('RET-1')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-open-returns-value')).toHaveTextContent('2');
    expect(screen.getAllByTestId('widget-error')).toHaveLength(1);
  });

  it('retry succeeds: only the orders key is revalidated', async () => {
    let fail = true;
    overrides['/api/seller/dashboard/recent-orders'] = () => (fail ? down() : Response.json(BODIES['/api/seller/dashboard/recent-orders']));
    renderDashboard();
    const widget = await screen.findByTestId('widget-orders');
    await within(widget).findByRole('button', { name: 'Retry' });
    await screen.findByText('RET-1');
    fail = false;
    fetchMock.mockClear();
    await userEvent.click(within(widget).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('kpi-open-orders-value')).toHaveTextContent('7'));
    expect(within(widget).getByText('ORD-1')).toBeInTheDocument();
    expect(requested()).toEqual(['/api/seller/dashboard/recent-orders']);
  });

  const WIDGETS: Array<[string, string, string]> = [
    ['returns', '/api/seller/dashboard/returns', 'widget-returns'],
    ['stock', '/api/seller/dashboard/stock', 'widget-stock'],
    ['renewals', '/api/seller/dashboard/renewals', 'widget-renewals'],
    ['store performance', '/api/seller/dashboard/store-performance', 'widget-store-performance'],
    ['orders', '/api/seller/dashboard/recent-orders', 'widget-orders'],
  ];
  it.each(WIDGETS)('one widget failing does not remove the others: %s', async (_name, path, testId) => {
    overrides[path] = down;
    renderDashboard();
    const failed = await screen.findByTestId(testId);
    await within(failed).findByTestId('widget-error');
    const others = WIDGETS.filter(([, , id]) => id !== testId);
    for (const [, , id] of others) {
      const card = screen.getByTestId(id);
      await waitFor(() => expect(within(card).queryByTestId('widget-loading')).not.toBeInTheDocument());
      expect(within(card).queryByTestId('widget-error')).not.toBeInTheDocument();
    }
    expect(screen.getAllByTestId('widget-error')).toHaveLength(1);
  });

  it('a failing KPI source reads Unavailable on those tiles only; a failing heads-up simply is not shown', async () => {
    overrides['/api/seller/dashboard/kpis'] = down;
    overrides['/api/seller/dashboard/heads-up'] = down;
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('kpi-open-returns-value')).toHaveTextContent('Unavailable'));
    expect(screen.getByTestId('kpi-unanswered-reviews-value')).toHaveTextContent('Unavailable');
    await waitFor(() => expect(screen.getByTestId('kpi-open-orders-value')).toHaveTextContent('7'));
    expect(screen.queryByTestId('heads-up')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('widget-error')).toHaveLength(0);
  });

  it('status chips use the four tones', async () => {
    renderDashboard();
    const widget = await screen.findByTestId('widget-orders');
    const chip = async (label: string) => (await within(widget).findByText(label)) as HTMLElement;
    expect((await chip('Shipped')).dataset.tone).toBe('success');
    expect((await chip('Processing')).dataset.tone).toBe('info');
    expect((await chip('Payment pending')).dataset.tone).toBe('warning');
    expect((await chip('Cancelled')).dataset.tone).toBe('critical');
    expect((await chip('Shipped')).className).toContain('bg-bg-success-subdued');
    expect((await chip('Cancelled')).className).toContain('bg-bg-critical-subdued');
  });

  it('empty states for returns, stock, renewals', async () => {
    overrides['/api/seller/dashboard/returns'] = () => Response.json([]);
    overrides['/api/seller/dashboard/stock'] = () => Response.json([]);
    overrides['/api/seller/dashboard/renewals'] = () => Response.json([]);
    overrides['/api/seller/dashboard/recent-orders'] = () => Response.json({ orders: [], openCount: 0 });
    renderDashboard();
    expect(await screen.findByText('No returns need your attention.')).toBeInTheDocument();
    expect(await screen.findByText('All branches are stocked.')).toBeInTheDocument();
    expect(await screen.findByText('No renewals in the next 7 days.')).toBeInTheDocument();
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('kpi-open-orders-value')).toHaveTextContent('0'));
  });

  it('heads-up banner links to the assortment filter with a path that starts with a slash', async () => {
    renderDashboard();
    const banner = await screen.findByTestId('heads-up');
    expect(within(banner).getByRole('link', { name: 'Review' }).getAttribute('href')).toMatch(/\/catalog\?tab=assortment&stock=none$/);
    expect(screen.getAllByTestId('heads-up')).toHaveLength(1);
  });

  it('role matrix: Admin sees Your store; Buyer does not and never requests it', async () => {
    const admin = renderDashboard(['admin']);
    expect(await screen.findByRole('heading', { name: 'Your store' })).toBeInTheDocument();
    expect(await screen.findByTestId('perf-sales')).toHaveTextContent('1,500.00');
    expect(screen.getByTestId('sales-chart')).toBeInTheDocument();
    admin.unmount();
    fetchMock.mockClear();
    renderDashboard(['buyer']);
    await screen.findByText('RET-1');
    expect(screen.queryByRole('heading', { name: 'Your store' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('widget-store-performance')).not.toBeInTheDocument();
    expect(requested()).not.toContain('/api/seller/dashboard/store-performance');
    // nothing about buying from Malva
    expect(document.body.textContent).not.toMatch(/invoice|credit|approval|Outstanding/i);
  });

  it('forwards ?simulate= outside production and ignores it in production', async () => {
    window.history.replaceState(null, '', '/?simulate=orders-down');
    renderDashboard(['buyer']);
    await screen.findByText('RET-1');
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain('/api/seller/dashboard/recent-orders?simulate=orders-down');
    document.body.innerHTML = '';
    fetchMock.mockClear();
    vi.stubEnv('NODE_ENV', 'production');
    renderDashboard(['buyer']);
    await screen.findByText('RET-1');
    expect(fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('simulate'))).toEqual([]);
  });

  it('renders in de-DE with the German copy and euro formatting', async () => {
    renderDashboard(['admin'], 'de-DE');
    expect(await screen.findByText('Letzte Bestellungen')).toBeInTheDocument();
    expect(await screen.findByText('Offene Bestellungen')).toBeInTheDocument();
    expect((await screen.findAllByText(/123,45\s?€/)).length).toBeGreaterThan(0);
  });
});

describe('Greeting', () => {
  const at = (iso: string) => new Date(iso);
  const header = (now: Date) =>
    renderWithProviders(<DashboardHeader now={now} name="Anna" store="DACH Online" region="DE" currency="EUR" />, { locale: 'en-US', messages: en });

  it('greeting by hour in Europe/Berlin (07:00, 14:00, 20:00)', () => {
    // Berlin is UTC+2 on 2026-10-12.
    expect(greetingKey(at('2026-10-12T05:00:00Z'))).toBe('morning');
    expect(greetingKey(at('2026-10-12T12:00:00Z'))).toBe('afternoon');
    expect(greetingKey(at('2026-10-12T18:00:00Z'))).toBe('evening');
    expect(berlinHour(at('2026-10-12T05:00:00Z'))).toBe(7);
    // the server's own zone does not matter: 22:30 UTC is already 00:30 the next day in Berlin
    expect(greetingKey(at('2026-10-12T22:30:00Z'))).toBe('evening');
    expect(greetingKey(at('2026-10-12T02:59:00Z'))).toBe('evening');
  });

  it('renders the greeting and the subtitle with store, region and currency', () => {
    header(at('2026-10-12T05:00:00Z'));
    expect(screen.getByRole('heading', { name: 'Good morning, Anna' })).toBeInTheDocument();
    expect(screen.getByText('DACH Online · Germany · EUR')).toBeInTheDocument();
  });

  it('afternoon and evening wording', () => {
    const first = header(at('2026-10-12T12:00:00Z'));
    expect(screen.getByRole('heading', { name: 'Good afternoon, Anna' })).toBeInTheDocument();
    first.unmount();
    header(at('2026-10-12T18:00:00Z'));
    expect(screen.getByRole('heading', { name: 'Good evening, Anna' })).toBeInTheDocument();
  });
});
