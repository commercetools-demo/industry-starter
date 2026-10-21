import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import PasswordForm from '@/components/account/PasswordForm';
import ProfileForm from '@/components/account/ProfileForm';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'maya@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: 'a1', addresses: [] };
const profile = (over: Record<string, unknown> = {}) => ({ firstName: 'Maya', lastName: 'Okonkwo', email: 'maya@example.com', phone: '+1 555 0100', defaultShippingAddressId: 'a1', ...over });
const address = (id: string, label: string) => ({
  id, label, firstName: 'M', lastName: 'O', streetName: `${id} Main St`, additionalStreetInfo: null, city: 'NYC', state: 'NY',
  postalCode: '10012', country: 'US', phone: null, isDefaultShipping: id === 'a1', isDefaultBilling: false,
});
const body = (init?: RequestInit) => JSON.parse(String(init?.body));

beforeEach(() => {
  nav.pathname = '/account/profile';
});
afterEach(() => vi.unstubAllGlobals());

describe('ProfileForm', () => {
  it('Email is read-only with the contact-us help', async () => {
    stubFetch({ '/api/auth/me': () => ({ customer }), '/api/account/profile': () => ({ profile: profile() }), '/api/account/addresses': () => ({ addresses: [address('a1', 'Home')] }) });
    renderShell(<ProfileForm />);
    const email = await screen.findByLabelText('Email');
    expect(email).toHaveAttribute('readonly');
    expect(email).toHaveValue('maya@example.com');
    expect(screen.getByText('To change your email, contact us.')).toBeInTheDocument();
  });

  it('Phone disabled with no address, with a hint', async () => {
    stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/account/profile': () => ({ profile: profile({ phone: null, defaultShippingAddressId: null }) }),
      '/api/account/addresses': () => ({ addresses: [] }),
    });
    renderShell(<ProfileForm />);
    const phone = await screen.findByLabelText('Phone');
    await waitFor(() => expect(phone).toBeDisabled());
    expect(screen.getByText('Add an address to save a phone number.')).toBeInTheDocument();
  });

  it('saves names, phone and the default address in one PATCH', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/account/profile': (init) => (init?.method === 'PATCH' ? { profile: profile({ firstName: 'Mia', defaultShippingAddressId: 'a2' }) } : { profile: profile() }),
      '/api/account/addresses': () => ({ addresses: [address('a1', 'Home'), address('a2', 'Work')] }),
    });
    renderShell(<ProfileForm />);
    const first = await screen.findByLabelText('First name');
    await screen.findByRole('option', { name: /Work/ });
    await userEvent.clear(first);
    await userEvent.type(first, 'Mia');
    await userEvent.selectOptions(screen.getByLabelText('Default address'), 'a2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(true));
    expect(body(calls.find((c) => c.init?.method === 'PATCH')?.init)).toEqual({
      firstName: 'Mia', lastName: 'Okonkwo', phone: '+1 555 0100', defaultShippingAddressId: 'a2',
    });
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });

  it('refuses an empty name beside the field and sends nothing', async () => {
    const { calls } = stubFetch({ '/api/auth/me': () => ({ customer }), '/api/account/profile': () => ({ profile: profile() }), '/api/account/addresses': () => ({ addresses: [address('a1', 'Home')] }) });
    renderShell(<ProfileForm />);
    await userEvent.clear(await screen.findByLabelText('First name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('This field is required.')).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });
});

describe('PasswordForm', () => {
  const setup = (answer: () => Response) => {
    stubFetch({ '/api/auth/me': () => ({ customer }), '/api/account/password': answer });
    renderShell(<PasswordForm />);
  };
  const fill = async (current: string, next: string) => {
    await userEvent.type(screen.getByLabelText('Current password'), current);
    await userEvent.type(screen.getByLabelText('New password'), next);
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  };

  it('Wrong current password gives the specific message', async () => {
    setup(() => Response.json({ error: { code: 'current_password_invalid', message: 'x' } }, { status: 400 }));
    await fill('old-pass-1', 'new-pass-22');
    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
  });

  it('a refused policy marks the rules the server named', async () => {
    setup(() => Response.json({ error: { code: 'password_policy', message: 'x', failed: ['digit'] } }, { status: 422 }));
    await fill('old-pass-1', 'newpasswordnodigit');
    expect(await screen.findByText('Your new password does not meet the requirements.')).toBeInTheDocument();
  });

  it('a rate limited answer says to try later', async () => {
    setup(() => Response.json({ error: { code: 'rate_limited', message: 'x', retryAfterSeconds: 60 } }, { status: 429 }));
    await fill('old-pass-1', 'new-pass-22');
    expect(await screen.findByText('Too many attempts. Try again later.')).toBeInTheDocument();
  });

  it('success clears the fields and confirms', async () => {
    setup(() => Response.json({ ok: true }));
    await fill('old-pass-1', 'new-pass-22');
    expect(await screen.findByText('Password updated.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });
});
