import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { RegisterForm } from './RegisterForm';

const replace = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const reply = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

async function fillAll(password = 'longenough') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('First name'), 'Ada');
  await user.type(screen.getByLabelText('Last name'), 'Lovelace');
  await user.type(screen.getByLabelText('Email'), 'ada@b.co');
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterForm', () => {
  it('Register: posts the details and lands on the account page', async () => {
    const fetchMock = reply({ user: {} });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<RegisterForm />);
    await fillAll();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/account'));
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/auth/register');
    expect(JSON.parse(call![1].body)).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@b.co', password: 'longenough' });
  });

  it('Validation error: a short password is explained on the field and nothing is sent', async () => {
    const fetchMock = reply({});
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<RegisterForm />);
    await fillAll('short');
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby')!)).toHaveTextContent('Use at least 8 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Validation error: empty form flags every field', async () => {
    renderWithProviders(<RegisterForm />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getAllByText('This field is required')).toHaveLength(4);
  });

  it('Duplicate email: says the account cannot be created and offers sign-in', async () => {
    vi.stubGlobal('fetch', reply({ error: 'ACCOUNT_EXISTS' }, 409));
    renderWithProviders(<RegisterForm />);
    await fillAll();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not create an account with these details.');
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/en-US/account/sign-in');
    expect(replace).not.toHaveBeenCalled();
  });

  it('Return after register: honours a safe ?redirect', async () => {
    vi.stubGlobal('fetch', reply({ user: {} }));
    renderWithProviders(<RegisterForm redirect="/en-US/saved" />);
    await fillAll();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/saved'));
  });
});
