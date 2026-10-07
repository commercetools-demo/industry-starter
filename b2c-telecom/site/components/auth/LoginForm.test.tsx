import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { LoginForm } from './LoginForm';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

const failure = (status: number, code: string) => new Response(JSON.stringify({ error: { code, message: 'x' } }), { status });
const signedIn = (redirectTo = '/en-US/account') =>
  new Response(JSON.stringify({ user: { id: 'c-1' }, cart: null, mergeNotes: [], redirectTo }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginForm', () => {
  it('Failed sign in is ambiguous: both failures show the same message in the alert region', async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(401, 'INVALID_CREDENTIALS'));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<LoginForm />);

    await fill('', '');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email and password.');
    expect(fetchMock).not.toHaveBeenCalled();

    await fill('nobody@example.com', 'Wrong-Password-1');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email and password.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('marks both inputs invalid and describes them by the alert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(401, 'INVALID_CREDENTIALS')));
    renderWithProviders(<LoginForm />);
    await fill('a@b.co', 'x');
    const alert = await screen.findByText('Enter a valid email and password.');
    expect(alert).toHaveAttribute('id', 'login-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    for (const input of [screen.getByLabelText('Email'), screen.getByLabelText('Password')]) {
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'login-error');
    }
  });

  it('starts empty with the right autocomplete attributes and no demo note', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
  });

  it('has a visible focus ring on every interactive element', () => {
    renderWithProviders(<LoginForm />);
    const elements = [screen.getByLabelText('Email'), screen.getByLabelText('Password'), screen.getByRole('button', { name: 'Log in' }), screen.getByRole('link', { name: 'Forgot your password?' }), screen.getByRole('link', { name: 'New to Malva? Create an account' })];
    for (const element of elements) expect(element).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-action');
  });

  it('posts the credentials with the return target and goes to the validated redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(signedIn('/en-US/bundle'));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<LoginForm returnTo="/en-US/bundle" />);
    await fill('jane@example.com', 'Aa1-valid-pass');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/bundle'));
    expect(router.refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'jane@example.com', password: 'Aa1-valid-pass', returnTo: '/en-US/bundle', locale: 'en-US' });
  });

  it('shows the rate limit message, not the credentials message, for a 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(429, 'RATE_LIMITED')));
    renderWithProviders(<LoginForm />);
    await fill('a@b.co', 'x');
    expect(await screen.findByText('Too many attempts. Try again later.')).toBeInTheDocument();
  });

  it('shows a service message when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderWithProviders(<LoginForm />);
    await fill('a@b.co', 'x');
    expect(await screen.findByText('The service is temporarily unavailable. Try again.')).toBeInTheDocument();
  });

  it('carries the return target to the register and forgot-password links and shows the reset notice', () => {
    renderWithProviders(<LoginForm returnTo="/en-US/bundle" resetDone />);
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/en-US/forgot-password?returnTo=%2Fen-US%2Fbundle');
    expect(screen.getByRole('link', { name: 'New to Malva? Create an account' })).toHaveAttribute('href', '/en-US/register?returnTo=%2Fen-US%2Fbundle');
    expect(screen.getByText('Password changed. Log in with your new password.')).toHaveAttribute('role', 'status');
  });

  it('de-DE texts', async () => {
    renderWithProviders(<LoginForm />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Passwort vergessen?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neu bei Malva? Konto erstellen' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Geben Sie eine gültige E-Mail-Adresse und ein gültiges Passwort ein.');
  });

  it('the password can be shown and hidden', async () => {
    renderWithProviders(<LoginForm />);
    const user = userEvent.setup();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
