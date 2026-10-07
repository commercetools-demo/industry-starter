import { act, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import useSWR from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import type { Cart } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { AuthError, useAuthMutations, type AuthMutations } from './useAuthMutations';

const cart = (names: string[]): Cart => ({ id: 'cart-9', itemCount: names.length, lines: names.map((name, index) => ({ id: `l${index}`, name })) }) as unknown as Cart;

const captured: { current?: AuthMutations } = {};
/** The hook as the tests call it (set in an effect, never during render). */
const mutations = (): AuthMutations => {
  if (!captured.current) throw new Error('Probe is not rendered');
  return captured.current;
};
function Probe() {
  const api = useAuthMutations();
  useEffect(() => {
    captured.current = api;
  }, [api]);
  const { data } = useSWR<Cart | null>(KEY_CART, () => null);
  return <p data-testid="cart">{data === undefined ? 'unknown' : data === null ? 'none' : data.lines.map((line) => line.name).join(',')}</p>;
}

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useAuthMutations', () => {
  it('Sign in carries the anonymous cart: no items are silently dropped', async () => {
    const merged = cart(['Cable 500', 'Unlimited Phone']);
    vi.stubGlobal('fetch', respond(200, { user: { id: 'c-1' }, cart: merged, mergeNotes: [], redirectTo: '/en-US/account' }));
    renderWithProviders(<Probe />);
    await act(async () => {
      await mutations().login({ email: 'jane@example.com', password: 'Aa1-valid-pass', locale: 'en-US' });
    });
    // The cache holds exactly what the server merged: both lines, nothing computed or removed on the client.
    expect(screen.getByTestId('cart')).toHaveTextContent('Cable 500,Unlimited Phone');
  });

  it('announces lines that need attention after the merge in a toast with a link to My bundle', async () => {
    const merged = cart(['Cable 500']);
    vi.stubGlobal('fetch', respond(200, { user: { id: 'c-1' }, cart: merged, mergeNotes: [{ key: 'review', count: 1, names: 'Cable 500' }], redirectTo: '/en-US/account' }));
    renderWithProviders(<Probe />);
    await act(async () => {
      await mutations().login({ email: 'jane@example.com', password: 'Aa1-valid-pass', locale: 'en-US' });
    });
    expect(await screen.findByText('1 item(s) in your bundle need your attention: Cable 500.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review My bundle' })).toHaveAttribute('href', '/en-US/bundle');
  });

  it('shows no toast when nothing needs attention', async () => {
    vi.stubGlobal('fetch', respond(201, { user: { id: 'c-1' }, cart: null, mergeNotes: [], redirectTo: '/en-US/account' }));
    renderWithProviders(<Probe />);
    await act(async () => {
      await mutations().register({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Aa1-valid-pass', locale: 'en-US' });
    });
    expect(screen.queryByText(/need your attention/)).not.toBeInTheDocument();
    expect(screen.getByTestId('cart')).toHaveTextContent('none');
  });

  it('logout empties the bundle cache', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true }));
    renderWithProviders(<Probe />);
    await act(async () => {
      await mutations().logout();
    });
    await waitFor(() => expect(screen.getByTestId('cart')).toHaveTextContent('none'));
  });

  it('throws an AuthError with the stable code, status and details of a refusal', async () => {
    vi.stubGlobal('fetch', respond(400, { error: { code: 'WEAK_PASSWORD', message: 'x', details: { failed: ['digit'] } } }));
    renderWithProviders(<Probe />);
    const error = await mutations().register({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'x', locale: 'en-US' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ code: 'WEAK_PASSWORD', status: 400, details: { failed: ['digit'] } });
  });

  it('a network failure is an AuthError NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderWithProviders(<Probe />);
    await expect(mutations().forgotPassword({ email: 'a@b.co', locale: 'en-US' })).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
  });

  it('posts JSON to the right routes', async () => {
    const fetchMock = respond(200, { ok: true, redirectTo: '/en-US/login?reset=1' });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Probe />);
    await mutations().resetPassword({ token: 'reset-token-123456', password: 'New-Passw0rd-2026', locale: 'en-US' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/reset-password');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});
