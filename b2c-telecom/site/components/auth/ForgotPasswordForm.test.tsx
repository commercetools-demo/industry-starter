import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { ForgotPasswordForm } from './ForgotPasswordForm';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

async function submit(email: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
}

describe('ForgotPasswordForm', () => {
  it('replaces the form with the generic confirmation and no demo link when the server sends none', async () => {
    const fetchMock = ok({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ForgotPasswordForm />);
    await submit('nobody@example.com');
    expect(await screen.findByText('If an account exists for that email, a reset link has been prepared.')).toBeInTheDocument();
    expect(screen.queryByText('Demo mode: email delivery is disabled.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open the reset link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send reset link' })).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/forgot-password');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'nobody@example.com', locale: 'en-US' });
  });

  it('shows the demo banner and the link (locale not doubled) when the server returns demoLink', async () => {
    vi.stubGlobal('fetch', ok({ ok: true, demoLink: '/en-US/reset-password?token=abc12345' }));
    renderWithProviders(<ForgotPasswordForm />);
    await submit('jane@example.com');
    expect(await screen.findByText('Demo mode: email delivery is disabled.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the reset link' })).toHaveAttribute('href', '/en-US/reset-password?token=abc12345');
    expect(screen.getByText(/your email address is confirmed when you finish/)).toBeInTheDocument();
  });

  it('refuses an implausible email without a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ForgotPasswordForm />);
    await submit('nope');
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the rate limit message and keeps the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'x' } }), { status: 429 })));
    renderWithProviders(<ForgotPasswordForm />);
    await submit('jane@example.com');
    expect(await screen.findByText('Too many attempts. Try again later.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled());
  });

  it('can hide the back link and carries the return target', () => {
    const { unmount } = renderWithProviders(<ForgotPasswordForm returnTo="/en-US/bundle" />);
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/en-US/login?returnTo=%2Fen-US%2Fbundle');
    unmount();
    renderWithProviders(<ForgotPasswordForm showBackLink={false} />);
    expect(screen.queryByRole('link', { name: 'Back to log in' })).not.toBeInTheDocument();
  });

  it('de-DE confirmation', async () => {
    vi.stubGlobal('fetch', ok({ ok: true }));
    renderWithProviders(<ForgotPasswordForm />, { locale: 'de-DE' });
    await userEvent.setup().type(screen.getByLabelText('E-Mail'), 'jane@example.com');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Link senden' }));
    expect(await screen.findByText('Falls zu dieser E-Mail-Adresse ein Konto existiert, wurde ein Link zum Zurücksetzen vorbereitet.')).toBeInTheDocument();
  });
});
