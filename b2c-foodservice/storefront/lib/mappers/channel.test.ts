import { afterEach, describe, expect, it, vi } from 'vitest';
import { channelFixture } from '@/lib/mappers/__fixtures__/channels';
import { mapChannel, mapChannels, parseHours } from '@/lib/mappers/channel';

afterEach(() => vi.restoreAllMocks());

describe('channel mapper', () => {
  it('maps geoLocation coordinates as lng lat', () => {
    const store = mapChannel(channelFixture(), 'en-US');
    expect(store?.geo).toEqual({ lat: 40.7233, lng: -74.003 });
    expect(store).toMatchObject({
      key: 'mcf-store-nyc-soho', name: 'Malva SoHo', addressLine: '1 Prince St',
      city: 'New York', postalCode: '10012', country: 'US', collectionMinutes: 15,
      timeZone: 'America/New_York',
    });
    expect(store?.hours.mon).toEqual({ open: '07:00', close: '18:00' });
    expect(store?.hours.sun).toBeNull();
  });

  it('invalid hours JSON becomes closed and is logged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = mapChannel(channelFixture({ fields: { hours: '{not json' } }), 'en-US');
    expect(Object.values(store!.hours).every((d) => d === null)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('mcf-store-nyc-soho');
    expect(line).not.toContain('Prince');
  });

  it('defaults the collection minutes and falls back to the structured address', () => {
    const store = mapChannel(channelFixture({ fields: { addressLine: undefined, collectionMinutes: undefined } }), 'en-US');
    expect(store?.addressLine).toBe('1 Prince St');
    expect(store?.collectionMinutes).toBe(30);
  });

  it('Store list shows only InventorySupply channels', () => {
    const noRole = channelFixture({ id: 'a', key: 'mcf-store-no-role', roles: ['ProductDistribution'] });
    const noPrefix = channelFixture({ id: 'b', key: 'other-warehouse' });
    const ok = channelFixture({ id: 'c', key: 'mcf-store-nyc-astoria' });
    const stores = mapChannels([noRole, noPrefix, ok], 'en-US');
    expect(stores.map((s) => s.key)).toEqual(['mcf-store-nyc-astoria']);
  });

  it('rejects malformed hour windows', () => {
    expect(parseHours('{"mon":{"open":"9am","close":"18:00"}}')).toBeNull();
    expect(parseHours('{"mon":{"open":"18:00","close":"07:00"}}')).toBeNull();
    expect(parseHours('[]')).toBeNull();
    expect(parseHours(undefined)).toBeNull();
  });
});
