// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { distanceKm } from '@/lib/geo/distance';
import { formatDistance, formatTime, marketLabel } from './format';

describe('Utility bar and picker display helpers', () => {
  it('formats opening times per locale', () => {
    expect(formatTime('20:00', 'en-US')).toBe('8 PM');
    expect(formatTime('08:30', 'en-US')).toBe('8:30 AM');
    expect(formatTime('20:00', 'de-DE')).toBe('20 Uhr');
    expect(formatTime('08:30', 'de-DE')).toBe('8:30 Uhr');
  });
  it('formats distances', () => {
    expect(formatDistance(2.34, 'en-US')).toBe('2.3 km');
    expect(formatDistance(2.34, 'de-DE')).toBe('2,3 km');
    expect(formatDistance(142.6, 'en-US')).toBe('143 km');
  });
  it('the market label states country, currency code and symbol', () => {
    expect(marketLabel('de-DE')).toBe('Deutschland (EUR €)');
    expect(marketLabel('en-US')).toBe('United States (USD $)');
  });
  it('haversine distance Hamburg to Berlin is about 255 km', () => {
    const d = distanceKm({ lat: 53.5511, lng: 9.9937 }, { lat: 52.52, lng: 13.405 });
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(260);
    expect(distanceKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});
