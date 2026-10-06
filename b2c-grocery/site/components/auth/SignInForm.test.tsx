import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { SignInForm } from './SignInForm';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh }),
}));

const reply = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignInForm', () => {
  it('Wrong password: shows the generic message "Email or password is incorrect"', async () => {
    vi.stubGlobal('fetch', reply({ error: 'INVALID_CREDENTIALS' }, 401));
    renderWithProviders(<SignInForm />);
    await fill('a@b.co', 'wrong-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(replace).not.toHaveBeenCalled();
  });

  it('Unknown email shows the very same message', async () => {
    vi.stubGlobal('fetch', reply({ error: 'INVALID_CREDENTIALS' }, 401));
    renderWithProviders(<SignInForm />);
    await fill('nobody@b.co', 'whatever-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('Validation error: empty fields show messages tied to the inputs with aria-describedby, and nothing is sent', async () => {
    const fetchMock = reply({});
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<SignInForm />);
    await fill('', '');
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(email.getAttribute('aria-describedby')!)).toHaveTextContent('This field is required');
    expect(document.getElementById(password.getAttribute('aria-describedby')!)).toHaveTextContent('This field is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Validation error: a malformed email is explained', async () => {
    renderWithProviders(<SignInForm />);
    await fill('not-an-email', 'secret-pass');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('Return after sign-in: ?redirect=/en-US/saved is honored (locale prefix left to the router)', async () => {
    vi.stubGlobal('fetch', reply({ user: {} }));
    renderWithProviders(<SignInForm redirect="/en-US/saved" />);
    await fill('a@b.co', 'secret-pass');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/saved'));
  });

  it('Return after sign-in: an unsafe redirect falls back to the account page', async () => {
    vi.stubGlobal('fetch', reply({ user: {} }));
    renderWithProviders(<SignInForm redirect="https://evil.com" />);
    await fill('a@b.co', 'secret-pass');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/account'));
  });

  it('Rate limited: tells the shopper to wait', async () => {
    vi.stubGlobal('fetch', reply({ error: 'RATE_LIMITED' }, 429));
    renderWithProviders(<SignInForm />);
    await fill('a@b.co', 'secret-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('German labels', () => {
    renderWithProviders(<SignInForm />, { locale: 'de-DE' });
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
  });
});
