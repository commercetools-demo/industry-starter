import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { LogoutButton } from './LogoutButton';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LogoutButton', () => {
  it('posts the logout, then goes home and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.refresh).toHaveBeenCalled();
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/auth/logout');
  });

  it('stays on the page and shows an error toast when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderWithProviders(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('The service is temporarily unavailable. Try again.')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
