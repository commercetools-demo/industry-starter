import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { ResetPasswordForm } from './ResetPasswordForm';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function submit(password: string) {
  const user = userEvent.setup();
  if (password) await user.type(screen.getByLabelText('New password'), password);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('ResetPasswordForm', () => {
  it('a weak password shows the rule and makes no network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ResetPasswordForm token="reset-token-123456" />);
    await submit('weak');
    expect((await screen.findAllByText('Use at least 10 characters.')).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the token and password, then goes to the login page with the reset notice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, redirectTo: '/en-US/login?reset=1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ResetPasswordForm token="reset-token-123456" />);
    await submit('New-Passw0rd-2026');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?reset=1'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/reset-password');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'reset-token-123456', password: 'New-Passw0rd-2026', locale: 'en-US' });
  });

  it('a token that was used meanwhile shows the expired message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_TOKEN', message: 'x' } }), { status: 400 })));
    renderWithProviders(<ResetPasswordForm token="reset-token-123456" />);
    await submit('New-Passw0rd-2026');
    expect(await screen.findByText('This reset link is no longer usable')).toBeInTheDocument();
  });

  it('autocomplete is new-password and the field starts empty', () => {
    renderWithProviders(<ResetPasswordForm token="reset-token-123456" />);
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });
});
