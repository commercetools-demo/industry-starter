import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';

let pathname = '/en-US/plumbing';
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useParams: () => ({ locale: 'en-US' }) }));

const { TopBar } = await import('./TopBar');
const { Nav } = await import('./Nav');
const { Footer } = await import('./Footer');
const { PortalDialogProvider } = await import('@/context/portal-dialog');

const fetchStub = (map: Record<string, unknown> = {}) => vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(map[url] ?? { error: 'no' }), { status: map[url] ? 200 : 404 })));
const Providers = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en-US" messages={messages}>
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><PortalDialogProvider>{children}</PortalDialogProvider></SWRConfig>
  </NextIntlClientProvider>
);
const show = async (...parts: Array<() => ReactNode>) => render(<Providers>{parts.map((P, i) => <P key={i} />)}</Providers>);
afterEach(() => { vi.unstubAllGlobals(); pathname = '/en-US/plumbing'; });

describe('malva-homepage › Global chrome on every page', () => {
  it('Emergency number: a tel: link in the top bar', async () => {
    fetchStub();
    await show(TopBar);
    const link = screen.getByRole('link', { name: '0800 555 0142' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^tel:\+?\d+$/));
  });
  it('Current section: the matching link has aria-current, the others do not', async () => {
    fetchStub();
    pathname = '/en-US/plumbing/drain-cleaning-cctv-survey';
    await show(Nav);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Plumbing' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Waste management' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current');
  });
  it('Quote list slot is always present (reserved) and shows the count only when above zero', async () => {
    fetchStub({ '/api/quote-list': { id: 'c', lines: [], count: 3 } });
    const { container } = await show(Nav);
    const slot = container.querySelector('.ql')!;
    expect(slot).toHaveAttribute('data-empty', 'true');
    expect(await screen.findByRole('link', { name: 'Quote list (3)' })).toBeInTheDocument();
    expect(container.querySelector('.ql')).toBe(slot);
    expect(slot).toHaveAttribute('data-empty', 'false');
  });
  it('Small screen: the menu button opens a panel with every link; Escape closes it and focus returns to the button', async () => {
    fetchStub();
    const user = userEvent.setup();
    await show(Nav);
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    const panel = screen.getByRole('dialog', { name: 'Site menu' });
    expect(within(panel).getAllByRole('link').map((l) => l.textContent)).toEqual(['Plumbing', 'Waste management', 'About', 'Request a quote']);
    expect(within(panel).getByRole('button', { name: 'Client portal' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
  it('the Client portal button opens the dialog; focus is trapped, Escape closes, focus returns', async () => {
    fetchStub();
    const user = userEvent.setup();
    await show(TopBar);
    const opener = screen.getByRole('button', { name: 'Client portal' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Client portal' });
    expect(within(dialog).getByLabelText(/Email/)).toHaveFocus();
    expect(within(dialog).getByRole('link', { name: 'Register your company' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Request a quote' })).toBeInTheDocument();
    expect(within(dialog).queryByText(/forgot|reset/i)).toBeNull();
    for (let i = 0; i < 6; i += 1) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true); }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
  it('a click on the backdrop closes the dialog; a click inside does not', async () => {
    fetchStub();
    const user = userEvent.setup();
    await show(TopBar);
    await user.click(screen.getByRole('button', { name: 'Client portal' }));
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('dialog-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('the footer lists the services, company links, the portal button and the privacy notice', async () => {
    fetchStub();
    await show(Footer);
    for (const name of ['About Malva', 'Request a quote', 'Privacy notice', 'Pipe installation & repair', 'Compliance reporting']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Client portal' })).toBeInTheDocument();
  });
  it('language switch links to the same page in the other locale', async () => {
    fetchStub();
    pathname = '/en-US/plumbing/drain-cleaning-cctv-survey';
    await show(TopBar);
    const de = screen.getByRole('link', { name: 'Deutsch (DE)' });
    expect(de).toHaveAttribute('href', '/de-DE/plumbing/drain-cleaning-cctv-survey');
    expect(screen.getByRole('link', { name: 'English (US)' })).toHaveAttribute('aria-current', 'true');
  });
  it('signed in: the portal control becomes a link to the portal', async () => {
    fetchStub({ '/api/auth/me': { customerId: 'c', email: 'e@x.co', businessUnitKey: 'b' } });
    await show(TopBar);
    expect(await screen.findByRole('link', { name: 'Client portal' })).toHaveAttribute('href', '/en-US/account');
  });
  it('has no axe violations (top bar, nav, footer)', async () => {
    fetchStub();
    const { container } = await show(TopBar, Nav, Footer);
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
