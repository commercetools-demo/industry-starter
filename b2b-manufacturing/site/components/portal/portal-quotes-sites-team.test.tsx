import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';

let search = '';
const replace = vi.fn(); const refresh = vi.fn();
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/en-US/account/quotes', useSearchParams: () => new URLSearchParams(search), useRouter: () => ({ push: vi.fn(), replace, refresh, prefetch: vi.fn() }),
}));
const { QuotesList } = await import('./QuotesList');
const { QuotesDetail } = await import('./QuotesDetail');
const { SitesManager } = await import('./SitesManager');
const { TeamManager } = await import('./TeamManager');
const { TeamFirstSignIn } = await import('./TeamFirstSignIn');

const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en-US" messages={messages}><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig></NextIntlClientProvider>);
type Hit = unknown | { __status: number; body: unknown };
const routes = (map: Record<string, Hit>) => vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
  const hit = map[`${init?.method ?? 'GET'} ${url}`] ?? map[url];
  if (hit === undefined) return new Response(JSON.stringify({ error: 'no' }), { status: 404 });
  if (typeof hit === 'function') return new Response(JSON.stringify((hit as () => unknown)()), { status: 200 });
  const h = hit as { __status?: number; body?: unknown };
  return new Response(JSON.stringify(h.__status ? h.body : hit), { status: h.__status ?? 200 });
}));
const calls = (method: string, url: string) => (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u, i]) => u === url && (i?.method ?? 'GET') === method);
const me = { '/api/auth/me': { customerId: 'c', email: 'e', businessUnitKey: 'bu' } };
afterEach(() => { vi.unstubAllGlobals(); search = ''; replace.mockClear(); refresh.mockClear(); });

const can = { accept: false, decline: false, renegotiate: false, cancel: false };
const thread = (over: Record<string, unknown> = {}) => ({ id: 'r1', reference: 'MQ-AAA111', createdAt: '2026-10-01T09:00:00.000Z', services: ['Drain clearing'], site: 'Main plant', status: 'submitted', rounds: 0, expired: false, can, ...over });
const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const detail = (over: Record<string, unknown> = {}) => ({ ...thread(), lines: [{ name: 'Drain clearing', quantity: 1, frequency: 'monthly' }], comment: 'Call first', history: [], ...over });
const ready = (canOver: Partial<typeof can>) => detail({
  status: 'ready', rounds: 1, quoteId: 'q1', can: { ...can, ...canOver },
  lines: [{ name: 'Drain clearing', quantity: 1, unitPrice: money(5000), total: money(5000) }],
  history: [{ quoteId: 'q1', createdAt: '2026-10-03T09:00:00.000Z', status: 'ready', sellerComment: 'Valid 30 days', expired: false, lines: [], total: money(12500) }],
});

describe('malva-client-portal › Quotes and requests › screens', () => {
  it('lists requests with date DD/MM/YYYY and the status as words; the table has a caption and no a11y violations', async () => {
    routes({ ...me, '/api/quotes': { threads: [thread(), thread({ id: 'r2', reference: 'MQ-BBB222', status: 'ready', site: 'Depot', createdAt: '2026-09-01T00:00:00.000Z' })] } });
    const { container } = wrap(<QuotesList />);
    const table = await screen.findByRole('table', { name: 'Quote requests and quotes for your company' });
    expect(within(table).getByText('01/10/2026')).toBeInTheDocument();
    expect(within(table).getByText('Submitted')).toBeInTheDocument();
    expect(within(table).getByText('Quote ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View MQ-AAA111' })).toHaveAttribute('href', '/en-US/account/quotes/r1');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('headers sort (aria-sort) and the site filter writes ?site= into the URL', async () => {
    routes({ ...me, '/api/quotes': { threads: [thread(), thread({ id: 'r2', reference: 'MQ-BBB222', site: 'Depot', createdAt: '2026-09-01T00:00:00.000Z' })] } });
    wrap(<QuotesList />);
    await screen.findByRole('table');
    const firstRef = () => within(screen.getAllByRole('row')[1]!).getByText(/MQ-/).textContent;
    expect(firstRef()).toBe('MQ-AAA111');
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Reference' }));
    expect(screen.getByRole('columnheader', { name: /Reference/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(firstRef()).toBe('MQ-AAA111');
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Reference' }));
    expect(firstRef()).toBe('MQ-BBB222');
    await userEvent.selectOptions(screen.getByLabelText('Filter by site'), 'Depot');
    expect(replace).toHaveBeenCalledWith('/en-US/account/quotes?site=Depot');
  });
  it('the site filter from the URL narrows the rows', async () => {
    search = 'site=Depot';
    routes({ ...me, '/api/quotes': { threads: [thread(), thread({ id: 'r2', reference: 'MQ-BBB222', site: 'Depot' })] } });
    wrap(<QuotesList />);
    await screen.findByRole('table');
    expect(screen.queryByText('MQ-AAA111')).toBeNull();
    expect(screen.getByText('MQ-BBB222')).toBeInTheDocument();
  });
  it('empty state: "No quote requests yet." with a Request a quote link', async () => {
    routes({ ...me, '/api/quotes': { threads: [] } });
    wrap(<QuotesList />);
    expect(await screen.findByText('No quote requests yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a quote' })).toHaveAttribute('href', '/en-US/request-a-quote');
  });
  it('detail before a quote: lines without any price, the explanation, and Cancel for a Submitted request', async () => {
    routes({ ...me, '/api/quotes/r1': { thread: detail({ can: { ...can, cancel: true } }) } });
    wrap(<QuotesDetail id="r1" />);
    expect(await screen.findByRole('heading', { name: 'MQ-AAA111' })).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Price' })).toBeNull();
    expect(screen.getByText('Prices appear here once Malva has issued a quote.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
  });
});

describe('malva-client-portal › Quotes and requests › Accept a quote (screen)', () => {
  it('shows prices and the seller comment; Accept asks to confirm, posts once and shows Accepted', async () => {
    let done = false;
    routes({ ...me, '/api/quotes/r1': () => ({ thread: done ? { ...ready({}), status: 'accepted' } : ready({ accept: true, decline: true, renegotiate: true }) }), 'POST /api/quotes/q1/accept': () => { done = true; return { thread: { ...ready({}), status: 'accepted' } }; }, '/api/quotes': { threads: [] } });
    const { container } = wrap(<QuotesDetail id="r1" />);
    expect(await screen.findByText('$125.00')).toBeInTheDocument();
    expect(screen.getByText('Valid 30 days')).toBeInTheDocument();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Accept quote' }));
    expect(calls('POST', '/api/quotes/q1/accept')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, accept' }));
    await waitFor(() => expect(screen.getAllByText('Accepted').length).toBeGreaterThan(0));
    expect(calls('POST', '/api/quotes/q1/accept')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Accept quote' })).toBeNull();
    expect(screen.getAllByText('Quote accepted. Thank you.').length).toBeGreaterThan(0);
  });
  it('Ask a question sends the comment', async () => {
    routes({ ...me, '/api/quotes/r1': { thread: ready({ renegotiate: true }) }, 'POST /api/quotes/q1/renegotiate': { thread: { ...ready({}), status: 'renegotiation' } } });
    wrap(<QuotesDetail id="r1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ask a question' }));
    await userEvent.type(screen.getByLabelText(/Your question/), 'Is VAT included?');
    await userEvent.click(screen.getByRole('button', { name: 'Send to Malva' }));
    await waitFor(() => expect(calls('POST', '/api/quotes/q1/renegotiate')).toHaveLength(1));
    expect(JSON.parse(calls('POST', '/api/quotes/q1/renegotiate')[0]![1].body)).toEqual({ comment: 'Is VAT included?' });
  });
  it('a refusal from the server is shown and the quote is reloaded', async () => {
    routes({ ...me, '/api/quotes/r1': { thread: ready({ accept: true }) }, 'POST /api/quotes/q1/accept': { __status: 409, body: { error: 'This quote can no longer be changed. Reload to see its current state.' } } });
    wrap(<QuotesDetail id="r1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept quote' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, accept' }));
    expect(await screen.findByText(/can no longer be changed/)).toBeInTheDocument();
  });
});

describe('malva-client-portal › Quotes and requests › Without permission (screen)', () => {
  it('Finance: the quote is shown, Accept, Decline and Ask a question are absent and the reason is given', async () => {
    routes({ ...me, '/api/quotes/r1': { thread: ready({}) } });
    wrap(<QuotesDetail id="r1" />);
    expect(await screen.findByText('$125.00')).toBeInTheDocument();
    for (const name of ['Accept quote', 'Decline quote', 'Ask a question']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByText('Your role can view quotes but cannot accept or decline them.')).toBeInTheDocument();
  });
});

const site = { key: 's1', name: 'Main plant', contactName: 'Yara', phone: '555', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US', isDefault: true };
const depot = { ...site, key: 's2', name: 'Depot', isDefault: false };

describe('malva-client-portal › Sites and team › Sites screen', () => {
  it('an administrator adds a site through a labelled form', async () => {
    const after = { sites: [site, depot], canEdit: true };
    routes({ ...me, '/api/sites': { sites: [site], canEdit: true }, 'POST /api/sites': after });
    const { container } = wrap(<SitesManager />);
    await screen.findByRole('table', { name: 'Sites of your company' });
    expect(screen.getByText('Default site')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a site' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Site name/), 'Depot');
    await userEvent.type(within(dialog).getByLabelText(/Street address/), '2 Depot Road');
    await userEvent.type(within(dialog).getByLabelText(/City/), 'Columbus');
    await userEvent.type(within(dialog).getByLabelText(/Postal code/), '43215');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save site' }));
    expect((await screen.findAllByText('Site saved.')).length).toBeGreaterThan(0);
    expect(JSON.parse(calls('POST', '/api/sites')[0]![1].body)).toMatchObject({ name: 'Depot', country: 'US', city: 'Columbus' });
    expect(screen.getByText(/2 Depot Road|Depot/)).toBeInTheDocument();
  });
  it('removing a site that an open request uses shows the explanation and keeps the dialog', async () => {
    routes({ ...me, '/api/sites': { sites: [site, depot], canEdit: true }, 'DELETE /api/sites/s2': { __status: 409, body: { error: 'This site is used by an open quote request, so it cannot be removed yet.' } } });
    wrap(<SitesManager />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Depot' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, remove' }));
    expect(await screen.findByText(/used by an open quote request/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('without permission the table is read only: no add, edit, remove or default controls', async () => {
    routes({ ...me, '/api/sites': { sites: [site, depot], canEdit: false } });
    wrap(<SitesManager />);
    await screen.findByRole('table');
    expect(screen.getByText('Only company administrators can change sites.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

const member = (over: Record<string, unknown>) => ({ customerId: 'm', name: 'Sam Site', email: 'sam@co.test', roleKeys: ['mpw-site-contact'], isYou: false, ...over });
const admin = member({ customerId: 'a', name: 'Ada Admin', email: 'ada@co.test', roleKeys: ['mpw-admin'], isYou: true });

describe('malva-client-portal › Sites and team › Team screen', () => {
  it('Invite a user: the one-time password is shown once and the dialog only closes with "I\'ve copied it"', async () => {
    routes({
      ...me, '/api/team': { members: [admin], canEdit: true },
      'POST /api/team': { member: member({ customerId: 'n', name: 'New Colleague' }), temporaryPassword: 'abcde-fghjk-23456' },
    });
    const { container } = wrap(<TeamManager />);
    await screen.findByRole('table', { name: 'People in your company' });
    await userEvent.click(screen.getByRole('button', { name: 'Add a colleague' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/First name/), 'New');
    await userEvent.type(within(dialog).getByLabelText(/Last name/), 'Colleague');
    await userEvent.type(within(dialog).getByLabelText(/Work email/), 'new@co.test');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));
    const pw = await screen.findByLabelText('One-time password');
    expect(pw).toHaveValue('abcde-fghjk-23456');
    expect(JSON.parse(calls('POST', '/api/team')[0]![1].body)).toMatchObject({ email: 'new@co.test', roleKey: 'mpw-site-contact' });
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByLabelText('One-time password')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('password-dialog'));
    expect(screen.getByLabelText('One-time password')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "I've copied it" }));
    expect(screen.queryByLabelText('One-time password')).toBeNull();
    expect(document.body.textContent).not.toContain('abcde-fghjk-23456');
  });
  it('Last administrator: demoting or removing the only administrator shows the refusal', async () => {
    const refusal = { __status: 409, body: { error: 'A company needs at least one administrator. Make someone else an administrator first.' } };
    routes({ ...me, '/api/team': { members: [admin, member({})], canEdit: true }, 'PATCH /api/team/a': refusal, 'DELETE /api/team/a': refusal });
    wrap(<TeamManager />);
    await userEvent.selectOptions(await screen.findByLabelText('Role for Ada Admin'), 'mpw-finance');
    expect(await screen.findByText(/at least one administrator/)).toBeInTheDocument();
    expect(screen.getByLabelText('Role for Ada Admin')).toHaveValue('mpw-admin');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ada Admin' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, remove' }));
    expect(await within(screen.getByRole('dialog')).findByText(/at least one administrator/)).toBeInTheDocument();
  });
  it('changing a role sends it and announces the change', async () => {
    routes({ ...me, '/api/team': { members: [admin, member({})], canEdit: true }, 'PATCH /api/team/m': { members: [admin, member({ roleKeys: ['mpw-finance'] })], canEdit: true } });
    wrap(<TeamManager />);
    await userEvent.selectOptions(await screen.findByLabelText('Role for Sam Site'), 'mpw-finance');
    expect((await screen.findAllByText('Role changed.')).length).toBeGreaterThan(0);
    expect(JSON.parse(calls('PATCH', '/api/team/m')[0]![1].body)).toEqual({ roleKey: 'mpw-finance' });
  });
  it('a Site contact or Finance user sees the team read only: role names as text, no controls', async () => {
    routes({ ...me, '/api/team': { members: [admin, member({})], canEdit: false } });
    wrap(<TeamManager />);
    await screen.findByRole('table');
    expect(screen.getByText('Only company administrators can change the team.')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('malva-client-portal › Sites and team › first sign-in password change', () => {
  it('posts the one-time and the new password, then leaves for the portal', async () => {
    routes({ 'POST /api/account/password': { ok: true } });
    wrap(<TeamFirstSignIn />);
    await userEvent.type(screen.getByLabelText(/One-time password/), 'abcde-fghjk-23456');
    await userEvent.type(screen.getByLabelText(/New password/), 'my-own-long-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en-US/account'));
    expect(JSON.parse(calls('POST', '/api/account/password')[0]![1].body)).toEqual({ currentPassword: 'abcde-fghjk-23456', newPassword: 'my-own-long-pass' });
  });
  it('a refusal stays on the form with the server sentence', async () => {
    routes({ 'POST /api/account/password': { __status: 400, body: { error: 'Use at least 10 characters.' } } });
    wrap(<TeamFirstSignIn />);
    await userEvent.type(screen.getByLabelText(/One-time password/), 'x');
    await userEvent.type(screen.getByLabelText(/New password/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
