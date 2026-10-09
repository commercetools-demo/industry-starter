import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { SignInCard } from './SignInCard';

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => router,
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sam = { id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockReset());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const fillSignIn = async (user: ReturnType<typeof userEvent.setup>, email = 'sam@example.com', password = 'secret-pass-123') => {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
};

describe('design-account-area: Sign in', () => {
  it('shows Email, Password, a full-width Sign in button and the create-account toggle; nothing prefilled, no demo note, no password reset', () => {
    const { container } = renderWithProviders(<SignInCard />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Malva' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toHaveClass('w-full');
    expect(screen.getByText('New to Malva?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/demo|any email|forgot|reset/i);
    expect(container.querySelector('a[href*="reset"], a[href*="forgot"]')).toBeNull();
  });

  it('the reason line appears under the title when the card was opened by a protected route', () => {
    renderWithProviders(<SignInCard reason="cart" />);
    expect(screen.getByText('Sign in to view your cart.')).toBeInTheDocument();
  });

  it('Create account mode adds Full name, changes the button and the toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByText('Have an account?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Malva' })).toBeInTheDocument();
  });

  it('initialMode "up" starts in create mode', () => {
    renderWithProviders(<SignInCard initialMode="up" />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });
});

describe('account-sign-in: Credentials accepted', () => {
  it('posts the credentials, goes to the stored next route and refreshes the server tree', async () => {
    fetchMock.mockResolvedValue(json(sam));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard next="/cart" />);
    await fillSignIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cart'));
    expect(router.refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'sam@example.com', password: 'secret-pass-123' });
  });

  it('default destination is /account', async () => {
    fetchMock.mockResolvedValue(json(sam));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/account'));
  });

  it('busy: the button is disabled and announced as busy while the request runs, and a second submit is ignored', async () => {
    let finish: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.type(screen.getByLabelText('Password'), '{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(json(sam));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });
});

describe('account-sign-in: Unknown and wrong are indistinguishable', () => {
  it('a refusal shows one inline error without naming a field, clears the password and focuses it', async () => {
    fetchMock.mockResolvedValue(json({ error: 'The email or password is not correct.' }, 401));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user, 'nobody@example.com', 'wrong-pass-123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The email or password is not correct.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('nobody@example.com');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('the same text appears for an unknown email and a known email with a wrong password', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ error: 'x' }, 401)));
    const user = userEvent.setup();
    const first = renderWithProviders(<SignInCard />);
    await fillSignIn(user, 'nobody@example.com', 'wrong-pass-123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const unknownText = (await screen.findByRole('alert')).textContent;
    first.unmount();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user, 'sam@example.com', 'wrong-pass-456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe(unknownText);
  });

  it('too many attempts and a network failure have their own plain messages', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Too many attempts. Please try again in 7 minutes.' }, 429));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i));
    expect(screen.getByRole('alert')).toHaveFocus();
  });
});

describe('account-sign-in: validation and focus', () => {
  it('empty submit shows field errors, calls nothing and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a malformed email is reported on the email field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillSignIn(user, 'not-an-email', 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('account-registration-request: Create account', () => {
  const fillRegister = async (user: ReturnType<typeof userEvent.setup>, password = 'a-long-passphrase') => {
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    await user.type(screen.getByLabelText('Full name'), 'Sam Rivera');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), password);
  };

  it('password shorter than 10 characters is refused on the client with the shared rule', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillRegister(user, 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at least 10 characters.', { selector: '[id$="-error"]' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the password rule as a hint', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
  });

  it('posts name, email and password, then lands on the destination; the account is already verified', async () => {
    fetchMock.mockResolvedValue(json({ ...sam, emailVerified: true }, 201));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard next="/prescriptions" />);
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/prescriptions'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' });
    expect(await screen.findByText('Your account is ready and your email address is confirmed.', { selector: '[role="status"]' })).toBeInTheDocument();
  });

  it('Address already registered: the refusal does not confirm the address and points to sign in', async () => {
    fetchMock.mockResolvedValue(json({ error: 'x' }, 409));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/sign in instead/i);
    expect(alert.textContent).not.toMatch(/already (registered|exists|in use)|sam@example\.com/i);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('server field problems are shown on the fields', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Check', fields: { email: 'invalid' } }, 400));
    const user = userEvent.setup();
    renderWithProviders(<SignInCard />);
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });
});

describe('demo patients (demo shops only)', () => {
  it('shows no buttons unless the server passes demo patients', () => {
    const { container } = renderWithProviders(<SignInCard />);
    expect(container.querySelector('[data-demo-patients]')).toBeNull();
  });
  it('shows small buttons under the card and signs the patient in with the slug only', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json(sam));
    const { container } = renderWithProviders(<SignInCard demoPatients={[{ slug: 'sam-rivera', label: 'Sam Rivera' }, { slug: 'alex-chen', label: 'Alex Chen' }]} />);
    const row = container.querySelector('[data-demo-patients]') as HTMLElement;
    expect(row).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sam Rivera' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/account'));
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/auth/demo-login');
    expect(JSON.parse(init.body)).toEqual({ slug: 'sam-rivera' });
  });
});
