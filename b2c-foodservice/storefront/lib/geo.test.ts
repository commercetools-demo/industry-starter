import { describe, expect, it } from 'vitest';
import { formatDistance, haversineKm } from '@/lib/geo';

const SOHO = { lat: 40.7233, lng: -74.003 };
const BROOKLYN = { lat: 40.6782, lng: -73.9442 };

describe('geo', () => {
  it('haversine Manhattan to Brooklyn is about 8 km', () => {
    const km = haversineKm(SOHO, BROOKLYN);
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(10);
    expect(haversineKm(SOHO, SOHO)).toBe(0);
  });

  it('distance is formatted in miles for en-US and en-CA', () => {
    expect(formatDistance(1.0, 'en-US')).toMatch(/0\.6\s?mi/);
    expect(formatDistance(1.0, 'en-CA')).toMatch(/0\.6\s?mi/);
  });
});
