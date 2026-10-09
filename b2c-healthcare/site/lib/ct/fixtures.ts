import 'server-only';

/**
 * Development-only data switch (`MALVA_FIXTURES=1`): the doctor list and the search page read the seed data
 * instead of commercetools, so the UI can be checked in a browser without credentials. Never active when
 * NODE_ENV is `production`. The loader keeps the seed data out of production bundles: the literal NODE_ENV
 * test lets the bundler drop the dynamic import there.
 */
export function fixturesEnabled(): boolean {
  return process.env.MALVA_FIXTURES === '1' && process.env.NODE_ENV !== 'production';
}

export type Fixtures = typeof import('./doctors-fixtures');

export async function loadFixtures(): Promise<Fixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./doctors-fixtures');
}

export type RxFixtures = typeof import('./rx-fixtures');

/** Sam Rivera's (and the other seed patients') prescriptions for `/prescriptions` (workstream N); same switch and guard. */
export async function loadRxFixtures(): Promise<RxFixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./rx-fixtures');
}

export type CartFixtures = typeof import('./cart-fixtures');

/** In-memory cart for browser checks with `MALVA_FIXTURES=1` (workstream O); same switch and guard. */
export async function loadCartFixtures(): Promise<CartFixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./cart-fixtures');
}

export type CheckoutFixtures = typeof import('./checkout-fixtures');

/** In-memory checkout state (address, delivery method, orders) for browser checks with `MALVA_FIXTURES=1` (workstream Q); same guard. */
export async function loadCheckoutFixtures(): Promise<CheckoutFixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./checkout-fixtures');
}

export type FundingFixtures = typeof import('./funding-fixtures');

/** In-memory allowance store and the seed's credentials for browser checks with `MALVA_FIXTURES=1` (workstream U); same guard. */
export async function loadFundingFixtures(): Promise<FundingFixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./funding-fixtures');
}

export type FakePaymentModule = typeof import('@/lib/checkout/fake-provider');

/**
 * The DEMO payment provider (workstream Q): in-memory authorizations, no payment service. Same guard as the other
 * loaders: null in production and unless `MALVA_FIXTURES=1`, so the fake can never take a real order's payment path.
 */
export async function loadFakePaymentProvider(): Promise<FakePaymentModule | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('@/lib/checkout/fake-provider');
}

export type AccountFixtures = typeof import('./account-fixtures');

/** In-memory saved lists, auto-refill and saved payment methods for browser checks with `MALVA_FIXTURES=1` (workstream T); same guard. */
export async function loadAccountFixtures(): Promise<AccountFixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./account-fixtures');
}

/**
 * In-memory Custom Objects and Customers (schedules, labs, bookings, address book) for browser checks with
 * `MALVA_FIXTURES=1` (workstream Z); same guard. Callers use `(await loadDevRoot()) ?? apiRoot`.
 */
export async function loadDevRoot(): Promise<import('@commercetools/platform-sdk').ByProjectKeyRequestBuilder | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return (await import('./dev-root')).createDevRoot();
}
