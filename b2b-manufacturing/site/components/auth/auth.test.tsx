import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';

const push = vi.fn();
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/account/sign-in', useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }) }));
const { SignInForm } = await import('./SignInForm');
const { RegisterForm } = await import('./RegisterForm');

const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en-US" messages={messages}><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig></NextIntlClientProvider>);
const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
afterEach(() => { vi.unstubAllGlobals(); push.mockClear(); });

describe('malva-client-portal › Client sign-in (form)', () => {
  it('offers registration and Request a quote, and no way to reset a password', async () => {
    const { container } = wrap(<SignInForm />);
    expect(screen.getByRole('link', { name: 'Register your company' })).toHaveAttribute('href', '/en-US/account/register');
    expect(screen.getByRole('link', { name: 'Request a quote' })).toHaveAttribute('href', '/en-US/request-a-quote');
    expect(container.textContent).not.toMatch(/forgot|reset/i);
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('Wrong credentials: shows the server message and stays', async () => {
    respond(401, { error: 'Email or password is incorrect.' });
    wrap(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findAllByText('Email or password is incorrect.')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Password/)).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });
  it('Return path: goes to a same-site next, ignores an external one', async () => {
    respond(200, { businessUnitKey: 'co' });
    const { unmount } = wrap(<SignInForm next="/en-US/account/quotes" />);
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en-US/account/quotes'));
    unmount(); push.mockClear();
    wrap(<SignInForm next="//evil.example" />);
    await userEvent.type(screen.getByLabelText(/Email/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/Password/), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en-US/account'));
  });
  it('asks for both fields before calling the server', async () => {
    respond(200, {});
    wrap(<SignInForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    // Only the sample-customer lookup (a GET) may have run; nothing is posted.
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toEqual([]);
    expect((await screen.findAllByText('Enter your email and password.')).length).toBeGreaterThan(0);
  });
});

describe('malva-client-portal › Open registration (form)', () => {
  it('shows field errors from the server on the right fields and links to the privacy notice', async () => {
    respond(400, { error: 'Check the highlighted fields.', fieldErrors: { password: 'Use at least 10 characters.', email: 'Enter a valid work email.' } });
    const { container } = wrap(<RegisterForm />);
    expect(screen.getByRole('link', { name: /privacy notice/i })).toHaveAttribute('href', '/en-US/privacy');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Work email/)).toHaveAttribute('aria-invalid', 'true');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('Register: posts the form and lands on the portal', async () => {
    respond(200, { businessUnitKey: 'mpw-x' });
    wrap(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/Company name/), 'Acme');
    await userEvent.selectOptions(screen.getByLabelText(/Sector/), 'manufacturing');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en-US/account'));
    const sent = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(sent).toMatchObject({ companyName: 'Acme', sector: 'manufacturing', website: '' });
    expect(sent.startedAt).toBeGreaterThan(0);
  });
});

describe('malva-client-portal › Sample customer sign-in (form)', () => {
  const users = [
    { email: 'demo.admin@example.com', name: 'Dana Admin', company: 'Northfield Foods (demo)', role: 'Administrator' },
    { email: 'other.admin@example.com', name: 'Olu Other', company: 'Riverside Care Group (demo)', role: 'Administrator' },
  ];
  it('shows a dropdown and a button below the form; the button signs in the chosen customer', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? { businessUnitKey: 'mpw-demo-co' } : { users }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = wrap(<SignInForm />);
    const select = await screen.findByLabelText('Sample customer');
    await userEvent.selectOptions(select, 'other.admin@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as sample customer' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(call[0]).toBe('/api/auth/demo-login');
    expect(JSON.parse(String(call[1]?.body))).toEqual({ email: 'other.admin@example.com' });
    expect(container.querySelector('form')!.compareDocumentPosition(screen.getByTestId('demo-login')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('renders nothing extra when no sample customers are offered', async () => {
    respond(200, { users: [] });
    wrap(<SignInForm />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('demo-login')).toBeNull();
  });
});
