import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { RegisterForm } from './RegisterForm';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

const failure = (status: number, code: string, details?: Record<string, unknown>) => new Response(JSON.stringify({ error: { code, message: 'x', ...(details ? { details } : {}) } }), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function fillAll(overrides: Partial<Record<'first' | 'last' | 'email' | 'password', string>> = {}) {
  const user = userEvent.setup();
  const values = { first: 'Chrome', last: 'Tester', email: 'chrome-r-1@example.com', password: 'Aa1-valid-pass-2026', ...overrides };
  if (values.first) await user.type(screen.getByLabelText('First name'), values.first);
  if (values.last) await user.type(screen.getByLabelText('Last name'), values.last);
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email);
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterForm', () => {
  it('a short password shows the first failed rule and makes no network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<RegisterForm />);
    await fillAll({ password: 'short1A' });
    expect(await screen.findAllByText('Use at least 10 characters.')).not.toHaveLength(0);
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('focuses the first invalid field and shows an error under each one', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderWithProviders(<RegisterForm />);
    await fillAll({ first: '', last: '', email: 'nope', password: '' });
    expect(screen.getByLabelText('First name')).toHaveFocus();
    expect(screen.getByText('Enter your first name (up to 60 characters).')).toBeInTheDocument();
    expect(screen.getByText('Enter your last name (up to 60 characters).')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-describedby', expect.stringContaining('-error'));
  });

  it('posts the account, then goes to the validated redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 'c-1' }, cart: null, mergeNotes: [], redirectTo: '/en-US/bundle' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<RegisterForm returnTo="/en-US/bundle" />);
    await fillAll({ email: ' Chrome-R-1@Example.com ' });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/bundle'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(init.body as string)).toEqual({ firstName: 'Chrome', lastName: 'Tester', email: 'chrome-r-1@example.com', password: 'Aa1-valid-pass-2026', returnTo: '/en-US/bundle', locale: 'en-US' });
  });

  it('a duplicate email shows the message under the email field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(409, 'ACCOUNT_EXISTS')));
    renderWithProviders(<RegisterForm />);
    await fillAll();
    expect(await screen.findByText('An account with this email already exists. Log in or reset your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('a server-side WEAK_PASSWORD names the first failed rule', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(400, 'WEAK_PASSWORD', { failed: ['digit'] })));
    renderWithProviders(<RegisterForm />);
    await fillAll();
    // Once in the field error, once in the requirements list.
    await waitFor(() => expect(screen.getAllByText('Add a number.')).toHaveLength(2));
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the rate limit message as a form error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failure(429, 'RATE_LIMITED')));
    renderWithProviders(<RegisterForm />);
    await fillAll();
    expect(await screen.findByText('Too many attempts. Try again later.')).toBeInTheDocument();
  });

  it('autocomplete attributes and the link back to login', () => {
    renderWithProviders(<RegisterForm returnTo="/en-US/bundle" />);
    expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name');
    expect(screen.getByLabelText('Last name')).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: 'Already have an account? Log in' })).toHaveAttribute('href', '/en-US/login?returnTo=%2Fen-US%2Fbundle');
    expect(screen.getByLabelText('First name')).toHaveValue('');
  });

  it('the strength list updates while typing', async () => {
    renderWithProviders(<RegisterForm />);
    expect(screen.getByText('0 of 5 requirements met')).toBeInTheDocument();
    await userEvent.setup().type(screen.getByLabelText('Password'), 'Abcdefghij');
    expect(screen.getByText('4 of 5 requirements met')).toBeInTheDocument();
  });
});
