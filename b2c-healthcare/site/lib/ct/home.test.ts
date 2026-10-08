// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorListItem } from '@/lib/types';

const listDoctors = vi.fn();
const getShippingMethods = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ listDoctors: (...a: unknown[]) => listDoctors(...a) }));
vi.mock('@/lib/ct/shipping', () => ({ getShippingMethods: () => getShippingMethods() }));
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }));

import { computeStats, getAvailableToday, getHomeSnapshot, getHomeStats, hasSameDayMethod } from './home';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };

function doc(key: string, o: { today?: boolean; at?: string | null; rating?: number | null; reviews?: number } = {}): DoctorListItem {
  const at = o.at === undefined ? '2026-10-08T17:00:00.000Z' : o.at;
  return {
    id: key, key, slug: key, name: `Dr. ${key}`, specialty: 'Cardiology', specialtyKey: 'cardiology', yearsExperience: 5,
    clinicName: '', city: 'austin', modes: ['remote', 'office'], fees: {}, rating: o.rating === undefined ? 4.5 : o.rating,
    reviewCount: o.reviews ?? 10, initials: 'DD', portraitUrl: null,
    next: at === null ? null : { startsAt: at, localDate: at.slice(0, 10), isToday: o.today ?? true },
  };
}

function serve(remote: DoctorListItem[], office: DoctorListItem[] = []) {
  listDoctors.mockImplementation(async (p: { mode: 'remote' | 'office' }) => ({ items: p.mode === 'remote' ? remote : office, facets: [] }));
}

beforeEach(() => {
  listDoctors.mockReset();
  getShippingMethods.mockReset();
});

describe('design-home-page: getAvailableToday', () => {
  it('Doctors available: only doctors with a slot today, soonest first, at most the limit', async () => {
    serve([doc('b', { at: '2026-10-08T19:00:00.000Z' }), doc('a', { at: '2026-10-08T15:00:00.000Z' }), doc('c', { today: false, at: '2026-10-09T15:00:00.000Z' }), doc('d', { at: '2026-10-08T20:00:00.000Z' }), doc('e', { at: '2026-10-08T21:00:00.000Z' })]);
    const result = await getAvailableToday(3, ctx);
    expect(result.state).toBe('today');
    expect(result.items.map((i) => i.doctor.key)).toEqual(['a', 'b', 'd']);
    expect(result.items.every((i) => i.mode === 'remote')).toBe(true);
  });

  it('a doctor with a slot today only in the office leads with the office mode', async () => {
    serve([doc('a', { today: false, at: '2026-10-09T15:00:00.000Z' })], [doc('a', { at: '2026-10-08T15:00:00.000Z' })]);
    const result = await getAvailableToday(3, ctx);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.mode).toBe('office');
    expect(result.items[0]?.doctor.next?.isToday).toBe(true);
  });

  it('No availability today: the next available days are returned, never a fixed list', async () => {
    serve([doc('b', { today: false, at: '2026-10-10T15:00:00.000Z' }), doc('a', { today: false, at: '2026-10-09T15:00:00.000Z' })]);
    const result = await getAvailableToday(3, ctx);
    expect(result.state).toBe('next');
    expect(result.items.map((i) => i.doctor.key)).toEqual(['a', 'b']);
  });

  it('No availability today: nobody has any slot, so the section is empty (hidden)', async () => {
    serve([doc('a', { at: null })], []);
    expect(await getAvailableToday(3, ctx)).toEqual({ state: 'none', items: [] });
    serve([], []);
    expect((await getAvailableToday(3, ctx)).state).toBe('none');
  });
});

describe('design-home-page: getHomeStats', () => {
  it('Statistics band: counts doctors once, weights the rating by review count, counts doctors free today', async () => {
    serve(
      [doc('a', { rating: 5, reviews: 30 }), doc('b', { rating: 4, reviews: 10, today: false, at: '2026-10-09T10:00:00.000Z' })],
      [doc('a', { rating: 5, reviews: 30 }), doc('c', { rating: null, reviews: 0, at: null })],
    );
    expect(await getHomeStats(ctx)).toEqual({ doctorCount: 3, averageRating: 4.8, availableToday: 1 });
  });

  it('a figure without a source is null: no doctors, no reviews, nobody free', () => {
    expect(computeStats({ remote: [], office: [] })).toEqual({ doctorCount: null, averageRating: null, availableToday: null });
    const stats = computeStats({ remote: [doc('a', { rating: null, reviews: 0, today: false })], office: [] });
    expect(stats).toEqual({ doctorCount: 1, averageRating: null, availableToday: null });
  });

  it('the snapshot is null when the sources fail (the sections are then hidden)', async () => {
    listDoctors.mockRejectedValue(new Error('down'));
    expect(await getHomeSnapshot(ctx)).toBeNull();
  });

  it('the snapshot carries both the cards and the stats from one read', async () => {
    serve([doc('a')]);
    const snapshot = await getHomeSnapshot(ctx);
    expect(snapshot?.available.items).toHaveLength(1);
    expect(snapshot?.stats.doctorCount).toBe(1);
    expect(listDoctors).toHaveBeenCalledTimes(2);
  });
});

describe('design-home-page: hasSameDayMethod', () => {
  const method = (key: string, rates = 1) => ({ id: key, key, name: key, description: {}, isDefault: false, rates: Array.from({ length: rates }, () => ({})) });
  it('is true only when a same-day method with a rate exists', async () => {
    getShippingMethods.mockResolvedValue([method('mlv-standard'), method('mlv-same-day')]);
    expect(await hasSameDayMethod()).toBe(true);
    getShippingMethods.mockResolvedValue([method('mlv-standard')]);
    expect(await hasSameDayMethod()).toBe(false);
    getShippingMethods.mockResolvedValue([method('mlv-same-day', 0)]);
    expect(await hasSameDayMethod()).toBe(false);
  });

  it('is false when shipping cannot be read', async () => {
    getShippingMethods.mockRejectedValue(new Error('down'));
    expect(await hasSameDayMethod()).toBe(false);
  });
});
