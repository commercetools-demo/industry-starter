import { act, renderHook, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressForm } from '@/components/account/AddressForm';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import type { Address } from '@/lib/types';
import { renderWithProviders, screen } from '@/test/utils';
import { useAddresses } from './use-addresses';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const addr = (over: Partial<Address> = {}): Address => ({
  id: 'a1', firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100', country: 'US', isDefault: false, ...over,
});
const input = { firstName: 'Sam', lastName: 'Rivera', street: '1 A St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100' };

let fetchMock: ReturnType<typeof vi.fn>;
const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('address-book: use-addresses', () => {
  it('Default preselected for a new order: defaultAddress is the default; the other two stay in the list', async () => {
    fetchMock.mockResolvedValue(json({ addresses: [addr({ id: 'a2', isDefault: true }), addr(), addr({ id: 'a3' })] }));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    expect(result.current.defaultAddress).toBeUndefined();
    await waitFor(() => expect(result.current.addresses).toHaveLength(3));
    expect(result.current.defaultAddress?.id).toBe('a2');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/addresses');
  });

  it('with no default the selector is null so the order asks the buyer to choose', async () => {
    fetchMock.mockResolvedValue(json({ addresses: [addr()] }));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    await waitFor(() => expect(result.current.addresses).toHaveLength(1));
    expect(result.current.defaultAddress).toBeNull();
  });

  it('a write replaces the cached list with the server\'s answer (no second GET)', async () => {
    fetchMock.mockResolvedValueOnce(json({ addresses: [] }));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    await waitFor(() => expect(result.current.addresses).toEqual([]));
    fetchMock.mockResolvedValueOnce(json({ status: 'saved', addresses: [addr({ isDefault: true })] }));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.add(input, { makeDefault: true });
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.defaultAddress?.id).toBe('a1');
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/api/account/addresses');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ street: '1 A St', makeDefault: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('update, remove and make-default call the per-address routes', async () => {
    fetchMock.mockResolvedValueOnce(json({ addresses: [addr()] }));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    await waitFor(() => expect(result.current.addresses).toHaveLength(1));
    fetchMock.mockResolvedValue(json({ status: 'saved', addresses: [] }));
    await act(async () => {
      await result.current.update('a/1', input);
      await result.current.makeDefault('a1');
      await result.current.remove('a1');
    });
    const calls = fetchMock.mock.calls.slice(1).map(([p, i]) => `${(i as RequestInit).method} ${p}`);
    expect(calls).toEqual(['PATCH /api/account/addresses/a%2F1', 'POST /api/account/addresses/a1/default', 'DELETE /api/account/addresses/a1']);
  });

  it('a warning, field problems, a server failure and a network failure are reported without changing the list', async () => {
    fetchMock.mockResolvedValueOnce(json({ addresses: [addr()] }));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    await waitFor(() => expect(result.current.addresses).toHaveLength(1));
    const run = async (response: Response | Error) => {
      if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
      else fetchMock.mockResolvedValueOnce(response);
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.add(input);
      });
      return outcome;
    };
    expect(await run(json({ status: 'needs-confirmation', warning: { fields: ['state', 'zip'], nearestState: 'CA' } }))).toEqual({
      ok: false, reason: 'needs-confirmation', warning: { fields: ['state', 'zip'], nearestState: 'CA' },
    });
    expect(await run(json({ error: 'x', fields: { zip: 'invalid' } }, 400))).toEqual({ ok: false, reason: 'invalid', fields: { zip: 'invalid' } });
    expect(await run(json({ error: 'x' }, 500))).toEqual({ ok: false, reason: 'failed', status: 500 });
    expect(await run(new TypeError('offline'))).toEqual({ ok: false, reason: 'failed', status: 0 });
    expect(result.current.addresses).toHaveLength(1);
  });

  it('a 401 on the list becomes `error` (the view shows the sign-in prompt)', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Please sign in to continue.' }, 401));
    const { result } = renderHook(() => useAddresses(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect((result.current.error as { status?: number }).status).toBe(401);
  });

  it('the cache key is the shared constant', () => {
    expect(KEY_ADDRESSES).toBe('addresses');
  });
});

describe('address-book: new address name', () => {
  it('the name of a new address defaults to the account name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressForm prefillName={{ firstName: 'Alex', lastName: 'Chen' }} onSave={vi.fn()} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alex');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Chen');
    await user.type(screen.getByLabelText(/First name/), 'ander');
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alexander');
  });

  it('editing keeps the saved name, not the account name', () => {
    renderWithProviders(<AddressForm initial={addr()} prefillName={{ firstName: 'Alex', lastName: 'Chen' }} onSave={vi.fn()} onCancel={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue('Sam');
  });
});
