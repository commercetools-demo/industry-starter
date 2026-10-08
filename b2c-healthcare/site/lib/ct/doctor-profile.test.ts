// @vitest-environment node
import type { ProductProjection } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const withKey = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    productProjections: () => ({
      withKey: (a: { key: string }) => {
        withKey(a);
        return { get: (q: unknown) => ({ execute: async () => get(a.key, q) }) };
      },
    }),
  },
}));
const listVerifiedReviews = vi.fn();
vi.mock('@/lib/ct/reviews', () => ({ listVerifiedReviews: (...a: unknown[]) => listVerifiedReviews(...a) }));
vi.mock('@/lib/ct/search', () => ({ searchProducts: vi.fn() }));
vi.mock('@/lib/ct/scheduling', () => ({ listFreeSlots: vi.fn() }));

import { getDoctorByKey } from './doctors';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const price = (key: string, cents: number) => ({ value: { centAmount: cents, currencyCode: 'USD', fractionDigits: 2 }, channel: { typeId: 'channel', id: key, obj: { key } } });
const projection = {
  id: 'p1',
  key: 'mlv-doc-amara-okafor',
  name: { 'en-US': 'Dr. Amara Okafor' },
  slug: { 'en-US': 'amara-okafor' },
  description: { 'en-US': 'Family doctor.' },
  reviewRatingStatistics: { averageRating: 4.8, count: 5 },
  masterVariant: {
    images: [{ url: 'https://img/p.jpg' }],
    prices: [price('mlv-remote', 3500)],
    attributes: [
      { name: 'specialty', value: { key: 'general-practice', label: 'General Practice' } },
      { name: 'yearsExperience', value: 12 },
      { name: 'languages', value: ['English', 'Igbo'] },
      { name: 'education', value: { 'en-US': 'MD, Example University' } },
      { name: 'clinicName', value: 'Malva Clinic · Midtown' },
      { name: 'modes', value: [{ key: 'remote', label: 'Remote' }] },
    ],
  },
} as unknown as ProductProjection;

beforeEach(() => {
  get.mockReset().mockResolvedValue({ body: projection });
  withKey.mockReset();
  listVerifiedReviews.mockReset().mockResolvedValue([
    { id: 'r1', rating: 5, title: 'Clear', text: 'Explained everything.', authorName: 'Someone Real', createdAt: '2026-09-12T10:00:00.000Z' },
  ]);
});

describe('design-pdp: getDoctorByKey', () => {
  it('maps the profile: bio, languages, education, clinic, rating and the fee of the offered mode only', async () => {
    const doctor = await getDoctorByKey('mlv-doc-amara-okafor', ctx);
    expect(doctor).toMatchObject({
      key: 'mlv-doc-amara-okafor',
      name: 'Dr. Amara Okafor',
      specialty: 'General Practice',
      yearsExperience: 12,
      bio: 'Family doctor.',
      languages: ['English', 'Igbo'],
      education: 'MD, Example University',
      clinicName: 'Malva Clinic · Midtown',
      rating: 4.8,
      reviewCount: 5,
      modes: ['remote'],
      portraitUrl: 'https://img/p.jpg',
    });
    expect(doctor?.fees.remote?.centAmount).toBe(3500);
    expect(doctor?.fees.office).toBeUndefined();
  });

  it('reads by key with the visitor price context and the price channels expanded', async () => {
    await getDoctorByKey('mlv-doc-amara-okafor', ctx);
    expect(get).toHaveBeenCalledWith('mlv-doc-amara-okafor', { queryArgs: { priceCurrency: 'USD', priceCountry: 'US', expand: ['masterVariant.prices[*].channel'] } });
  });

  it('carries the verified reviews without the author name', async () => {
    const doctor = await getDoctorByKey('mlv-doc-amara-okafor', ctx);
    expect(doctor?.reviews).toEqual([{ id: 'r1', rating: 5, title: 'Clear', text: 'Explained everything.', createdAt: '2026-09-12T10:00:00.000Z' }]);
    expect(JSON.stringify(doctor)).not.toContain('Someone Real');
  });

  it('a failing reviews read leaves the profile without reviews instead of failing', async () => {
    listVerifiedReviews.mockRejectedValue(new Error('boom'));
    expect((await getDoctorByKey('mlv-doc-amara-okafor', ctx))?.reviews).toEqual([]);
  });

  it('reviews: false skips the reviews read (used by the booking route)', async () => {
    await getDoctorByKey('mlv-doc-amara-okafor', ctx, { reviews: false });
    expect(listVerifiedReviews).not.toHaveBeenCalled();
  });

  it('Unknown doctor: a 404 from the platform is null, not an error', async () => {
    get.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getDoctorByKey('mlv-doc-nope', ctx)).toBeNull();
  });

  it('Unknown doctor: a key that is not a plausible key is null without calling the platform', async () => {
    expect(await getDoctorByKey('../etc', ctx)).toBeNull();
    expect(withKey).not.toHaveBeenCalled();
  });

  it('other platform errors propagate', async () => {
    get.mockRejectedValue(Object.assign(new Error('down'), { statusCode: 503 }));
    await expect(getDoctorByKey('mlv-doc-amara-okafor', ctx)).rejects.toThrow('down');
  });
});
