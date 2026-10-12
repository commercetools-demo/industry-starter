// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detail, summary } from '@/components/product/detail/test-fixtures';

const m = vi.hoisted(() => ({
  shell: vi.fn(),
  session: vi.fn(),
  vehicle: vi.fn(),
  product: vi.fn(),
  related: vi.fn(),
  reviews: vi.fn(),
  eligibility: vi.fn(),
  enabled: vi.fn(),
}));
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T>(fn: T) => fn }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext: m.shell }));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: m.vehicle }));
vi.mock('@/lib/ct/product-detail', () => ({ getProductBySlug: m.product, getRelatedSummaries: m.related }));
vi.mock('@/lib/ct/reviews', () => ({ listReviews: m.reviews, getReviewEligibility: m.eligibility, reviewSubmissionEnabled: m.enabled }));

import { getProductPage } from './load';

const branch = (key: string, name: string) => ({
  key,
  channelId: `ch-${key}`,
  name,
  address: { street: 'S', postalCode: '1', city: 'C' },
  hours: { mon: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'ship-to-store',
});
const shell = (over = {}) => ({
  storeId: 'store-1',
  settings: { name: 'Küstenwerk', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin', returnWindowDays: undefined },
  branches: [branch('a', 'A'), branch('b', 'B')],
  retailChannelId: 'retail',
  countries: ['DE'],
  ...over,
});
const input = { storeKey: 'mau-reseller-north', locale: 'en-US' as const, slug: 'x' };

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.shell.mockResolvedValue(shell());
  m.session.mockResolvedValue({ branchKey: 'b' });
  m.vehicle.mockResolvedValue(null);
  m.product.mockResolvedValue(detail());
  m.related.mockResolvedValue([summary()]);
  m.reviews.mockResolvedValue([]);
  m.enabled.mockReturnValue(false);
});

describe('getProductPage', () => {
  it('a missing product or store is not-found', async () => {
    m.product.mockResolvedValue(null);
    expect(await getProductPage(input)).toEqual({ kind: 'not-found' });
    m.shell.mockResolvedValue(null);
    expect(await getProductPage(input)).toEqual({ kind: 'not-found' });
  });

  it('reads price and stock for the branch of the session and the market of the locale', async () => {
    await getProductPage(input);
    expect(m.product).toHaveBeenCalledWith('mau-reseller-north', 'x', { locale: 'en-US', currency: 'USD', country: 'US', branchChannelId: 'ch-b', retailChannelId: 'retail' }, undefined);
  });

  it('return days default to 30 and follow the store setting', async () => {
    expect(await getProductPage(input)).toMatchObject({ returnDays: 30 });
    m.shell.mockResolvedValue(shell({ settings: { name: 'K', shipDays: { min: 1, max: 2 }, timezone: 'Europe/Berlin', returnWindowDays: 14 } }));
    expect(await getProductPage({ ...input, slug: 'y' })).toMatchObject({ returnDays: 14, canChangeStore: true });
  });

  it('the alternatives link is the product category, else all parts', async () => {
    expect(await getProductPage(input)).toMatchObject({ alternativesHref: '/mau-reseller-north/category/brakes' });
    m.product.mockResolvedValue(detail({ categoryTrail: [] }));
    expect(await getProductPage({ ...input, slug: 'z' })).toMatchObject({ alternativesHref: '/mau-reseller-north/parts' });
  });

  it('fit-only related parts when a vehicle is active', async () => {
    m.vehicle.mockResolvedValue({ fitKeys: ['k1'] });
    await getProductPage({ ...input, slug: 'v' });
    expect(m.related.mock.calls[0][3]).toEqual({ storeId: 'store-1', fitKeys: ['k1'] });
  });

  it('review form: off, signed out, eligibility', async () => {
    expect(await getProductPage({ ...input, slug: 'r1' })).toMatchObject({ reviewForm: null });
    m.enabled.mockReturnValue(true);
    expect(await getProductPage({ ...input, slug: 'r2' })).toMatchObject({ reviewForm: 'signed-out' });
    m.session.mockResolvedValue({ customerId: 'cust1' });
    m.eligibility.mockResolvedValue('eligible');
    expect(await getProductPage({ ...input, slug: 'r3' })).toMatchObject({ reviewForm: 'eligible' });
    expect(m.eligibility).toHaveBeenCalledWith('mau-reseller-north', 'cust1', 'p1');
  });

  it('a failing reviews or related read does not break the page', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.reviews.mockRejectedValue(new Error('down'));
    m.related.mockRejectedValue(new Error('down'));
    expect(await getProductPage({ ...input, slug: 'f' })).toMatchObject({ kind: 'ok', reviews: [], related: [] });
    error.mockRestore();
  });

  it('subscriptions follow the flag', async () => {
    vi.stubEnv('SUBSCRIPTIONS_PURCHASE_ENABLED', 'false');
    expect(await getProductPage({ ...input, slug: 's' })).toMatchObject({ subscriptionsEnabled: false });
    vi.unstubAllEnvs();
  });
});
