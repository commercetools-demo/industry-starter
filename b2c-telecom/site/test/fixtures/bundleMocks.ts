// Shared state and factories for the cart route tests (the `vi.mock` calls themselves stay in each test file; vitest hoists them).
import { CART_OFFERS } from '@/lib/cart/__fixtures__/offers';
import type { SessionData } from '@/lib/session-types';
import type { BuyerContext, Offer } from '@/lib/types';

export const routeState = {
  session: {} as SessionData,
  patches: [] as Partial<SessionData>[],
  offers: CART_OFFERS as Offer[],
  buyer: undefined as BuyerContext | undefined,
};

export const defaultBuyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  channel: 'online',
  now: new Date('2026-10-07T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});

export function resetRouteState(): void {
  routeState.session = { anonymousId: 'anon-1', cartId: 'cart-1' };
  routeState.patches = [];
  routeState.offers = CART_OFFERS;
  routeState.buyer = defaultBuyer();
}

export const sessionMock = {
  getSession: async (): Promise<SessionData> => routeState.session,
  updateSession: async (patch: Partial<SessionData>): Promise<SessionData> => {
    routeState.patches.push(patch);
    routeState.session = { ...routeState.session, ...patch };
    for (const key of Object.keys(patch) as (keyof SessionData)[]) if (patch[key] === undefined) delete routeState.session[key];
    return routeState.session;
  },
};

export const jsonRequest = (url: string, method: string, body?: unknown): Request =>
  new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
