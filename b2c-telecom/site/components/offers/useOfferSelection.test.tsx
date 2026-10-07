import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { CartError } from '@/hooks/useCart';
import { LISTED_CABLE_500, LISTED_PHONE_ESSENTIAL } from '@/lib/listing/__fixtures__/catalog';
import type { Cart } from '@/lib/types';
import en from '@/messages/en-US.json';
import { blockedError, cartLine, cartOf } from './__fixtures__/cart';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const ctx = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
vi.mock('@/context/CartProvider', () => ({ useCartContext: () => ctx.value }));

import { useOfferSelection } from './useOfferSelection';

const addLine = vi.fn();
const removeLine = vi.fn();
const setQuantity = vi.fn();

function setCart(cart: Cart | null): void {
  ctx.value = { cart, isLoading: false, itemCount: cart?.itemCount ?? 0, addLine, removeLine, setQuantity };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en-US" messages={en}>
    <ToastProvider>{children}</ToastProvider>
  </NextIntlClientProvider>
);

const PLAN_LINE = cartLine({ id: 'line-cable-500', offerKey: LISTED_CABLE_500.key, kind: 'plan', sku: 'MLV-cable-500-12M' });
const OTHER_PLAN_LINE = cartLine({ id: 'line-cable-100', offerKey: 'malva-offer-cable-100', kind: 'plan' });

beforeEach(() => {
  vi.clearAllMocks();
  addLine.mockResolvedValue(null);
  removeLine.mockResolvedValue(null);
  setQuantity.mockResolvedValue(null);
  setCart(null);
});

describe('useOfferSelection', () => {
  it("Offer configured and added from the listing: picked term's SKU added, cart updated, no navigation", async () => {
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-12M', 1);
    });
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(addLine).toHaveBeenCalledWith({ offerKey: 'malva-offer-cable-500', sku: 'MLV-cable-500-12M', quantity: 1 });
    expect(push).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
    expect(result.current.blocked).toBeNull();
  });

  it('Selected is derived from the bundle: a plan line of this offer', () => {
    setCart(cartOf([PLAN_LINE, cartLine({ id: 'dep', offerKey: 'malva-offer-spotify', kind: 'addon', parentLineId: 'line-cable-500' })]));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    expect(result.current.planLine?.id).toBe('line-cable-500');
    expect(result.current.dependents.map((line) => line.id)).toEqual(['dep']);
    const other = renderHook(() => useOfferSelection(LISTED_PHONE_ESSENTIAL), { wrapper });
    expect(other.result.current.planLine).toBeUndefined();
  });

  it('a refusal with a replace target asks first; confirm adds with replaceLineId, nothing changes before', async () => {
    setCart(cartOf([OTHER_PLAN_LINE]));
    addLine.mockRejectedValueOnce(
      blockedError({
        kind: 'conflict',
        offerKey: LISTED_CABLE_500.key,
        reasons: [],
        replace: { removeLineId: 'line-cable-100', removeOfferKey: 'malva-offer-cable-100', removeOfferName: 'Cable 100' },
      }),
    );
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-24M', 1);
    });
    expect(result.current.pending).toMatchObject({ kind: 'replace', heldName: 'Cable 100', replaceLineId: 'line-cable-100', dependentCount: 0 });
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(removeLine).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.confirm();
    });
    expect(addLine).toHaveBeenCalledTimes(2);
    expect(addLine).toHaveBeenLastCalledWith({ offerKey: 'malva-offer-cable-500', sku: 'MLV-cable-500-24M', quantity: 1, replaceLineId: 'line-cable-100' });
    expect(result.current.pending).toBeNull();
  });

  it('cancel leaves the bundle as it is', async () => {
    setCart(cartOf([OTHER_PLAN_LINE]));
    addLine.mockRejectedValueOnce(
      blockedError({ kind: 'conflict', offerKey: LISTED_CABLE_500.key, reasons: [], replace: { removeLineId: 'line-cable-100', removeOfferKey: 'x', removeOfferName: 'Cable 100' } }),
    );
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-24M', 1);
    });
    act(() => result.current.cancel());
    expect(result.current.pending).toBeNull();
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(removeLine).not.toHaveBeenCalled();
  });

  it('same-category replacement with dependents says how many add-ons go (D-026)', async () => {
    setCart(cartOf([OTHER_PLAN_LINE, cartLine({ id: 'a', offerKey: 'malva-offer-spotify', kind: 'addon', parentLineId: 'line-cable-100' }), cartLine({ id: 'b', offerKey: 'malva-offer-netflix', kind: 'addon', parentLineId: 'line-cable-100' })]));
    addLine.mockRejectedValueOnce(
      blockedError({
        kind: 'conflict',
        offerKey: LISTED_CABLE_500.key,
        reasons: [{ code: 'ONE_PLAN_PER_CATEGORY', messageKey: 'bundle.blocked.replacePlan', params: {}, offerKeys: [] }],
        replace: { removeLineId: 'line-cable-100', removeOfferKey: 'x', removeOfferName: 'Cable 100' },
      }),
    );
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-24M', 1);
    });
    expect(result.current.pending).toMatchObject({ kind: 'replace', dependentCount: 2 });
  });

  it('any other refusal is shown with its reasons and the bundle is untouched (no override)', async () => {
    addLine.mockRejectedValueOnce(
      blockedError({
        kind: 'incompatible',
        offerKey: LISTED_CABLE_500.key,
        reasons: [{ code: 'NOT_SERVICEABLE', messageKey: 'offers.reason.NOT_SERVICEABLE', params: { offerName: 'Cable 500', postalCode: '99999' }, offerKeys: [] }],
      }),
    );
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-24M', 1);
    });
    expect(result.current.blocked?.reasons[0].code).toBe('NOT_SERVICEABLE');
    expect(result.current.pending).toBeNull();
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(removeLine).not.toHaveBeenCalled();
    act(() => result.current.dismissBlocked());
    expect(result.current.blocked).toBeNull();
  });

  it('a failure that is not a refusal shows an error toast and no reasons', async () => {
    addLine.mockRejectedValueOnce(new CartError('NETWORK', 'UPSTREAM_ERROR', 'down'));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.choose('MLV-cable-500-24M', 1);
    });
    expect(result.current.blocked).toBeNull();
    expect(result.current.pending).toBeNull();
  });

  it('deselecting a plan without dependents removes it at once', async () => {
    setCart(cartOf([PLAN_LINE]));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.deselect();
    });
    expect(removeLine).toHaveBeenCalledWith('line-cable-500', undefined);
    expect(result.current.pending).toBeNull();
  });

  it('the activation fee line of a plan is not an add-on: it neither counts nor asks', async () => {
    setCart(cartOf([PLAN_LINE, cartLine({ id: 'fee', offerKey: LISTED_CABLE_500.key, kind: 'fee', parentLineId: 'line-cable-500' })]));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    expect(result.current.dependents).toEqual([]);
    await act(async () => {
      await result.current.deselect();
    });
    expect(removeLine).toHaveBeenCalledWith('line-cable-500', undefined);
  });

  it('deselecting a plan with dependents asks first, then removes with cascade', async () => {
    setCart(cartOf([PLAN_LINE, cartLine({ id: 'dep', offerKey: 'malva-offer-spotify', kind: 'addon', parentLineId: 'line-cable-500' })]));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    await act(async () => {
      await result.current.deselect();
    });
    expect(result.current.pending).toEqual({ kind: 'remove', dependentCount: 1 });
    expect(removeLine).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.confirm();
    });
    expect(removeLine).toHaveBeenCalledWith('line-cable-500', { cascade: true });
  });

  it('changing the number of lines of a selected plan sets the line quantity', async () => {
    setCart(cartOf([cartLine({ id: 'line-ess', offerKey: LISTED_PHONE_ESSENTIAL.key, kind: 'plan' })]));
    const { result } = renderHook(() => useOfferSelection(LISTED_PHONE_ESSENTIAL), { wrapper });
    await act(async () => {
      await result.current.changeQuantity(3);
    });
    expect(setQuantity).toHaveBeenCalledWith('line-ess', 3);
  });

  it('calls run one after the other: a second click while one is pending is ignored', async () => {
    let release: (cart: Cart | null) => void = () => undefined;
    addLine.mockReturnValueOnce(new Promise<Cart | null>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useOfferSelection(LISTED_CABLE_500), { wrapper });
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.choose('MLV-cable-500-24M', 1);
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    await act(async () => {
      await result.current.choose('MLV-cable-500-12M', 1);
    });
    expect(addLine).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
      await first;
    });
    expect(result.current.busy).toBe(false);
  });
});
