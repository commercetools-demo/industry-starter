import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Overview } from '@/lib/account-types';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'account' }),
}));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const getOverview = vi.fn();
const { AccountGoneError } = vi.hoisted(() => ({ AccountGoneError: class extends Error {} }));
vi.mock('@/lib/ct/account-summary', () => ({ AccountGoneError, getOverview: (...a: unknown[]) => getOverview(...a) }));

import AccountOverviewPage from './page';

const ok = <T,>(data: T) => ({ status: 'ok', data }) as const;
const lab = (id: string, name: string, status: 'ready' | 'processing' = 'ready') => ({ id, name, collectedAt: '2026-09-24', laboratory: 'Quest', status });
const full: Overview = {
  user: ok({ firstName: 'Sam', email: 'sam.rivera@example.com' }),
  labs: ok({ ready: 4, latest: [lab('LAB-50305', 'Thyroid panel (TSH)', 'processing'), lab('LAB-50301', 'Complete blood count'), lab('LAB-50302', 'Lipid panel')] }),
  appointments: ok({ upcoming: 1 }),
  orders: ok({ count: 0 }),
};
const empty: Overview = {
  user: ok({ firstName: 'Alex', email: 'alex@example.com' }),
  labs: ok({ ready: 0, latest: [] }),
  appointments: ok({ upcoming: 0 }),
  orders: ok({ count: 0 }),
};

const render = async () => renderWithProviders(<>{await AccountOverviewPage({ params: Promise.resolve({ locale: 'en-US' }) })}</>);
const tile = (label: string) => screen.getByText(label).closest('a') as HTMLElement;

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  getOverview.mockReset().mockResolvedValue(full);
  setPathname('/en-US/account');
});

describe('design-account-area: Overview', () => {
  it('Overview content: greeting, email, three linked tiles and the three latest labs', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Sam' })).toBeInTheDocument();
    expect(screen.getByText('sam.rivera@example.com')).toBeInTheDocument();
    expect(within(tile('Lab results ready')).getByText('4')).toBeInTheDocument();
    expect(tile('Lab results ready')).toHaveAttribute('href', '/en-US/account/labs');
    expect(within(tile('Appointments')).getByText('1')).toBeInTheDocument();
    expect(tile('Appointments')).toHaveAttribute('href', '/en-US/account/appointments');
    expect(within(tile('Orders')).getByText('0')).toBeInTheDocument();
    expect(tile('Orders')).toHaveAttribute('href', '/en-US/account/orders');
    const card = screen.getByRole('region', { name: 'Latest lab results' });
    const rows = within(card).getAllByRole('link');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveAttribute('href', '/en-US/account/labs/LAB-50301');
    expect(within(rows[0]).getByText('Processing')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Results ready')).toBeInTheDocument();
  });

  it('Zero states: tiles show 0 and the lab card says there are no results instead of rendering empty', async () => {
    getOverview.mockResolvedValue(empty);
    await render();
    for (const label of ['Lab results ready', 'Appointments', 'Orders']) expect(within(tile(label)).getByText('0')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'Latest lab results' });
    expect(within(card).getByText('No lab results yet.')).toBeInTheDocument();
    expect(within(card).queryAllByRole('link')).toHaveLength(0);
  });
});

describe('account-dashboard: Session-scoped account dashboard with explicit empty states', () => {
  it('Nothing yet on the account: every summary renders with an explicit nothing-here state, none is hidden', async () => {
    getOverview.mockResolvedValue(empty);
    await render();
    expect(screen.getAllByRole('link').filter((a) => a.hasAttribute('data-tile'))).toHaveLength(3);
    expect(screen.getByText('No lab results yet.')).toBeInTheDocument();
  });

  it('One backing service down: that tile says it could not load, the other tiles and the lab card keep their data', async () => {
    getOverview.mockResolvedValue({ ...full, orders: { status: 'error' } });
    await render();
    expect(within(tile('Orders')).getByText("Couldn't load")).toBeInTheDocument();
    expect(within(tile('Lab results ready')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Appointments')).getByText('1')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Results ready|Processing/ })).toHaveLength(3);
  });

  it('One backing service down: the lab source failing blanks only the lab tile and card', async () => {
    getOverview.mockResolvedValue({ ...full, labs: { status: 'error' } });
    await render();
    expect(within(tile('Lab results ready')).getByText("Couldn't load")).toBeInTheDocument();
    expect(screen.getByText("We couldn't load your lab results. Please try again.")).toBeInTheDocument();
    expect(within(tile('Appointments')).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Sam' })).toBeInTheDocument();
  });

  it('Session no longer valid: no account data is rendered, the prompt links to sign-in with the dashboard as destination', async () => {
    getSession.mockResolvedValue({});
    await render();
    expect(getOverview).not.toHaveBeenCalled();
    expect(screen.queryByText('Hello, Sam')).not.toBeInTheDocument();
    const href = screen.getByRole('link', { name: 'Sign in' }).getAttribute('href') ?? '';
    expect(new URL(href, 'http://x.test').searchParams.get('next')).toBe('/en-US/account');
  });

  it('Session no longer valid: a deleted account is treated the same way', async () => {
    getOverview.mockRejectedValue(new AccountGoneError());
    await render();
    expect(screen.queryByText(/Hello/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
