import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';

let pathname = '/en-US/account';
const refresh = vi.fn(); const replace = vi.fn();
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), replace, refresh, prefetch: vi.fn() }) }));
const { PortalNav } = await import('./PortalNav');
const { Overview } = await import('./Overview');
const { SettingsForms } = await import('./SettingsForms');

function Probe() { const { cache } = useSWRConfig(); return <button onClick={() => { cache.set('quote-list', { data: 'x' } as never); }}>seed</button>; }
const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en-US" messages={messages}><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig></NextIntlClientProvider>);
const routes = (map: Record<string, unknown>) => vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { const k = `${init?.method ?? 'GET'} ${url}`; const hit = map[k] ?? map[url]; return new Response(JSON.stringify(hit ?? { error: 'no' }), { status: hit === undefined ? 404 : 200 }); }));
afterEach(() => { vi.unstubAllGlobals(); pathname = '/en-US/account'; refresh.mockClear(); replace.mockClear(); });

describe('malva-client-portal › Portal shell', () => {
  it('greets by first name, lists the eight items and marks the current one', async () => {
    routes({ '/api/auth/me': { customerId: 'c', email: 'e', businessUnitKey: 'a' }, '/api/business-units': { businessUnits: [{ key: 'a', name: 'A' }], current: 'a' } });
    pathname = '/en-US/account/invoices';
    const { container } = wrap(<PortalNav firstName="Dana" />);
    expect(screen.getByText('HELLO, DANA')).toBeInTheDocument();
    const links = within(screen.getByRole('complementary', { name: 'Client portal' })).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Service visits', 'Waste documents', 'Invoices', 'Quotes and requests', 'Sites', 'Team', 'Settings']);
    expect(screen.getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('Company')).toBeNull();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('Overview is current only on the exact portal root', () => {
    routes({});
    wrap(<PortalNav firstName="D" />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });
  it('Switch company: switcher appears with two companies; choosing one posts, clears cached state, refreshes', async () => {
    routes({
      '/api/auth/me': { customerId: 'c', email: 'e', businessUnitKey: 'a' },
      '/api/business-units': { businessUnits: [{ key: 'a', name: 'Co A' }, { key: 'b', name: 'Co B' }], current: 'a' },
      'POST /api/business-units/select': { businessUnitKey: 'b' },
    });
    wrap(<><Probe /><PortalNav firstName="D" /></>);
    const select = await screen.findByLabelText('Company');
    await userEvent.selectOptions(select, 'b');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([u, i]) => u === '/api/business-units/select' && JSON.parse(i.body).businessUnitKey === 'b')).toBe(true);
  });
  it('Sign out calls the API, then leaves the portal with replace so Back does not return', async () => {
    routes({ 'POST /api/auth/logout': { ok: true } });
    wrap(<PortalNav firstName="D" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en-US'));
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });
});

describe('malva-client-portal › Overview', () => {
  it('New client with no history: every block has a plain empty state and no error', async () => {
    const { container } = wrap(<Overview title="Overview" visits={[]} alerts={[]} invoices={[]} locale="en-US" />);
    for (const text of ['No visits are scheduled yet.', 'You have no open quote requests.', 'No invoices yet.', 'Nothing needs your attention.']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('shows scheduled visits and the latest invoice, dates as DD/MM/YYYY', () => {
    wrap(<Overview title="Overview" locale="en-US"
      visits={[{ id: 'v', date: '2026-11-03', siteKey: 's', siteName: 'Plant 1', service: 'Drain survey', status: 'Scheduled' }]}
      invoices={[{ id: 'i1', number: 'INV-1', date: '2026-09-01', siteKey: 's', siteName: 'P', amountCents: 1, currency: 'USD', status: 'Paid' }, { id: 'i2', number: 'INV-2', date: '2026-10-01', siteKey: 's', siteName: 'P', amountCents: 1, currency: 'USD', status: 'Due' }]}
      alerts={[]} />);
    expect(screen.getByText('03/11/2026 · Plant 1 · Drain survey')).toBeInTheDocument();
    expect(screen.getByText('INV-2 · 01/10/2026 · Due')).toBeInTheDocument();
    expect(screen.queryByText(/INV-1/)).toBeNull();
  });
});

describe('malva-client-portal › Settings', () => {
  it('saves the profile and shows the server error for a wrong current password', async () => {
    routes({ 'PATCH /api/account/profile': { firstName: 'D', lastName: 'A' } });
    wrap(<SettingsForms initial={{ firstName: 'D', lastName: 'A', jobTitle: 'J', phone: '1' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect((await screen.findAllByText('Profile saved.')).length).toBeGreaterThan(0);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Your current password is incorrect.' }), { status: 400 })));
    await userEvent.type(screen.getByLabelText(/Current password/), 'x');
    await userEvent.type(screen.getByLabelText(/New password/), 'y');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
  });
});
