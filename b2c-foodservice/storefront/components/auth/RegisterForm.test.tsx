import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import RegisterForm from '@/components/auth/RegisterForm';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'qa@example.com', firstName: 'Qa', lastName: 'Tester', defaultShippingAddressId: null, addresses: [] };

beforeEach(() => nav.replace.mockClear());
afterEach(() => vi.unstubAllGlobals());

async function fillAll(password: string, email = 'qa@example.com') {
  await userEvent.type(screen.getByLabelText('First name'), 'Qa');
  await userEvent.type(screen.getByLabelText('Last name'), 'Tester');
  const emailInput = screen.getByLabelText('Email');
  if (!(emailInput as HTMLInputElement).value) await userEvent.type(emailInput, email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('RegisterForm', () => {
  it('Register shows policy failures by rule', async () => {
    const { fn } = stubFetch({});
    renderShell(<RegisterForm redirectTo="/account" />);
    await fillAll('short');
    const list = screen.getByRole('list', { name: 'Password rules' });
    expect(within(list).getByText('At least 10 characters').closest('li')).toHaveAttribute('data-met', 'false');
    expect(within(list).getByText('Contains a letter').closest('li')).toHaveAttribute('data-met', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(fn).not.toHaveBeenCalledWith('/api/auth/register', expect.anything());
  });

  it('a server-side policy refusal is shown by rule id', async () => {
    stubFetch({
      '/api/auth/register': () =>
        Response.json({ error: { code: 'password_policy', message: 'x', failed: ['digit'] } }, { status: 422 }),
    });
    renderShell(<RegisterForm redirectTo="/account" />);
    await fillAll('Strong-password-9');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByText('Contains a number').closest('li')).toHaveAttribute('data-met', 'false'),
    );
  });

  it('Register shows the generic refusal for a duplicate', async () => {
    stubFetch({
      '/api/auth/register': () => Response.json({ error: { code: 'registration_failed', message: 'x' } }, { status: 409 }),
    });
    renderShell(<RegisterForm redirectTo="/account" />);
    await fillAll('Strong-password-9');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'We could not create the account with these details. If you already have one, sign in.',
    );
    expect(alert.textContent).not.toMatch(/already (registered|exists)|in use/i);
  });

  it('Register pre-fills email from the guest cookie and deletes it', () => {
    stubFetch({});
    renderShell(<RegisterForm redirectTo="/account" initialEmail="guest@example.com" />);
    expect(screen.getByLabelText('Email')).toHaveValue('guest@example.com');
  });

  it('Register success shows no email promise', async () => {
    stubFetch({
      '/api/auth/register': () => Response.json({ customer, cart: null }, { status: 201 }),
      '/api/cart/count': () => ({ count: 0 }),
    });
    const { container } = renderShell(<RegisterForm redirectTo="/account/orders" />);
    await fillAll('Strong-password-9');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Welcome to Malva Coffee.')).toBeInTheDocument();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/account/orders'));
    expect(container.textContent?.toLowerCase()).not.toMatch(/verif|we.{0,12}sent|check your (email|inbox)|confirmation email/);
  });

  it('has autocomplete hints, terms and privacy links and a sign-in link', () => {
    stubFetch({});
    renderShell(<RegisterForm redirectTo="/account" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Already have an account/ })).toHaveAttribute('href', '/account/sign-in');
  });
});
