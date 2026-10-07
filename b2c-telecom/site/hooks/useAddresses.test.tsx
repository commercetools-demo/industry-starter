import { act, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import useSWR from 'swr';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import type { AddressInput, SavedAddress } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { AccountApiError } from './accountRequest';
import { useAuthMutations, type AuthMutations } from './useAuthMutations';
import { useAddressMutations, useAddresses, type AddressMutations } from './useAddresses';

const address = (id: string, over: Partial<SavedAddress> = {}): SavedAddress => ({
  id, firstName: 'Ada', lastName: 'L', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US',
  isService: true, isBilling: true, isDefaultService: false, isDefaultBilling: false, ...over,
});
const input: AddressInput = { firstName: 'Ada', lastName: 'L', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: true };

const captured: { mutations?: AddressMutations; auth?: AuthMutations } = {};
function Probe({ enabled = true }: { enabled?: boolean }) {
  const { addresses, defaultService, defaultBilling, isLoading } = useAddresses({ enabled });
  const mutations = useAddressMutations();
  const auth = useAuthMutations();
  useEffect(() => {
    captured.mutations = mutations;
    captured.auth = auth;
  }, [mutations, auth]);
  const cached = useSWR(KEY_ADDRESSES, null);
  return (
    <div>
      <p data-testid="ids">{addresses.map((a) => a.id).join(',')}</p>
      <p data-testid="service">{defaultService?.id ?? 'none'}</p>
      <p data-testid="billing">{defaultBilling?.id ?? 'none'}</p>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="cache">{cached.data === undefined ? 'empty' : 'filled'}</p>
    </div>
  );
}

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAddresses', () => {
  it('makes no request when disabled', async () => {
    const fetchMock = respond(200, { addresses: [] });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Probe enabled={false} />);
    await act(async () => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives the default service and billing addresses from the list', async () => {
    vi.stubGlobal('fetch', respond(200, { addresses: [address('a1'), address('a2', { isDefaultService: true }), address('a3', { isDefaultBilling: true })] }));
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('a1,a2,a3'));
    expect(screen.getByTestId('service')).toHaveTextContent('a2');
    expect(screen.getByTestId('billing')).toHaveTextContent('a3');
  });

  it('writes the answer of a mutation into the cache without refetching', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ addresses: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ addresses: [address('new', { isDefaultService: true })] }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      await captured.mutations?.add(input, { makeDefaultService: true });
    });
    expect(screen.getByTestId('ids')).toHaveTextContent('new');
    expect(screen.getByTestId('service')).toHaveTextContent('new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string)).toMatchObject({ address: { city: 'New York' }, makeDefaultService: true });
  });

  it('throws the server code and details of a refusal and leaves the cache as it was', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ addresses: [address('a1')] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'ADDRESS_UNRESOLVED', message: 'x', details: { unresolvedFields: ['city'] } } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('a1'));
    let caught: unknown;
    await act(async () => {
      caught = await captured.mutations?.add(input).catch((error: unknown) => error);
    });
    expect(caught).toBeInstanceOf(AccountApiError);
    expect(caught).toMatchObject({ code: 'ADDRESS_UNRESOLVED', status: 409, details: { unresolvedFields: ['city'] } });
    expect(screen.getByTestId('ids')).toHaveTextContent('a1');
  });

  it('logout clears the cached address book', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url === '/api/auth/logout' ? { ok: true } : { addresses: [address('a1')] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId('cache')).toHaveTextContent('filled'));
    await act(async () => {
      await captured.auth?.logout();
    });
    await waitFor(() => expect(screen.getByTestId('cache')).toHaveTextContent('empty'));
  });
});
