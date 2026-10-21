import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import SignInForm from '@/components/auth/SignInForm';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'A', lastName: 'B', defaultShippingAddressId: null, addresses: [] };
const bad = () => Response.json({ error: { code: 'invalid_credentials', message: 'x' } }, { status: 401 });
const demoOff = () => Response.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 });
const DEMO = {
  customers: [
    { key: 'mcf-customer-maya', name: 'Maya Okonkwo', market: 'US' },
    { key: 'mcf-customer-priya', name: 'Priya Nair', market: 'CA' },
  ],
};

beforeEach(() => {
  nav.replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

async function fill(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('SignInForm', () => {
  it('Failed sign in is ambiguous', async () => {
    stubFetch({ '/api/auth/demo-customers': demoOff, '/api/auth/login': bad, '/api/cart/count': () => ({ count: 0 }) });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await fill('known@example.com', 'wrong-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const first = (await screen.findByRole('alert')).textContent;
    await userEvent.type(screen.getByLabelText('Email'), '{selectall}{backspace}nobody@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'another-wrong-2');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(first));
    expect(first).toBe('Email or password is incorrect.');
  });

  it('Focus moves to the password after a failed sign in', async () => {
    stubFetch({ '/api/auth/demo-customers': demoOff, '/api/auth/login': bad, '/api/cart/count': () => ({ count: 0 }) });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await fill('a@example.com', 'wrong-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('a@example.com');
  });

  it('empty submit shows field errors and focuses the first', async () => {
    stubFetch({ '/api/auth/demo-customers': demoOff });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getAllByText('This field is required.')).toHaveLength(2);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(screen.getByLabelText('Email'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('Success redirects to the safe destination', async () => {
    const { calls } = stubFetch({
      '/api/auth/demo-customers': demoOff,
      '/api/auth/login': () => ({ customer, cart: null }),
      '/api/cart/count': () => ({ count: 0 }),
    });
    renderShell(<SignInForm redirectTo="/checkout" notice={null} />);
    await fill('a@example.com', 'right-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/checkout'));
    const login = calls.find((c) => c.url === '/api/auth/login');
    expect(JSON.parse(String(login?.init?.body))).toEqual({ email: 'a@example.com', password: 'right-password-1' });
  });

  it('a merged bag with more units than the guest bag shows the toast', async () => {
    stubFetch({
      '/api/auth/demo-customers': demoOff,
      '/api/auth/login': () => ({ customer, cart: { id: 'k', lineCount: 3, quantity: 5 } }),
      '/api/cart/count': () => ({ count: 2 }),
    });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await screen.findByRole('button', { name: 'Sign in' });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/cart/count')).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    await fill('a@example.com', 'right-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Your bag was added to your account.')).toBeInTheDocument();
  });

  it('too many attempts names the wait and disables the button', async () => {
    stubFetch({
      '/api/auth/demo-customers': demoOff,
      '/api/auth/login': () =>
        Response.json({ error: { code: 'too_many_attempts', message: 'x', retryAfterSeconds: 42 } }, { status: 429 }),
    });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await fill('a@example.com', 'whatever-password1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Try again in 42 seconds/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('an outage shows the generic text and a retry', async () => {
    stubFetch({
      '/api/auth/demo-customers': demoOff,
      '/api/auth/login': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await fill('a@example.com', 'whatever-password1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the signed-out notice', () => {
    stubFetch({ '/api/auth/demo-customers': demoOff });
    renderShell(<SignInForm redirectTo="/account" notice="signedOut" />);
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain('You are signed out.');
  });

  it('Sign-in page offers no federated button', async () => {
    stubFetch({ '/api/auth/demo-customers': demoOff });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '');
    expect(names.join('|')).not.toMatch(/google|apple|facebook|sso|single sign|microsoft|github/i);
    expect(screen.getAllByRole('button')).toHaveLength(2); // show password, sign in
  });

  it('Sign-in page has no forgot-password link', async () => {
    stubFetch({ '/api/auth/demo-customers': demoOff });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    expect(screen.queryByText(/forgot|reset/i)).toBeNull();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/account/register']);
  });
});

describe('Demo sign-in on the sign-in page', () => {
  it('Demo dropdown is not rendered when disabled', async () => {
    const { fn } = stubFetch({ '/api/auth/demo-customers': demoOff });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(screen.queryByText('Demo customers')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('lists customers by market without any email', async () => {
    stubFetch({ '/api/auth/demo-customers': () => DEMO });
    const { container } = renderShell(<SignInForm redirectTo="/account" notice={null} />);
    const select = await screen.findByRole('combobox', { name: 'Choose a demo customer' });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Maya Okonkwo (US)', 'Priya Nair (Canada)']);
    expect(Array.from(select.querySelectorAll('optgroup')).map((g) => g.label)).toEqual(['United States', 'Canada']);
    expect(container.innerHTML).not.toMatch(/@example\.com/);
  });

  it('signs in as the chosen customer and follows the same success path', async () => {
    const { calls } = stubFetch({
      '/api/auth/demo-customers': () => DEMO,
      '/api/auth/demo-login': () => ({ customer, cart: null }),
      '/api/cart/count': () => ({ count: 0 }),
    });
    renderShell(<SignInForm redirectTo="/account/orders" notice={null} />);
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Choose a demo customer' }), 'mcf-customer-priya');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/account/orders'));
    expect(JSON.parse(String(calls.find((c) => c.url === '/api/auth/demo-login')?.init?.body))).toEqual({ key: 'mcf-customer-priya' });
  });

  it('a demo failure uses the page-level error box', async () => {
    stubFetch({
      '/api/auth/demo-customers': () => DEMO,
      '/api/auth/demo-login': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(<SignInForm redirectTo="/account" notice={null} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in as' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side');
  });
});
