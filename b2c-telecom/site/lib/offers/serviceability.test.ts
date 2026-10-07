import { createCachedServiceability, createStubProvider, describeAvailability, normalizePostalCode, SEEDED_ZIPS, type ServiceabilityProvider } from './serviceability';

const cached = (mode: 'table' | 'all' | 'none' = 'table') => createCachedServiceability(createStubProvider(mode), 300);

describe('normalizePostalCode', () => {
  it('accepts US 5 digits and ZIP+4 (reduced to 5 digits) and trims', () => {
    expect(normalizePostalCode('10001', 'US')).toBe('10001');
    expect(normalizePostalCode(' 10001-1234 ', 'US')).toBe('10001');
  });
  it('accepts exactly 5 digits for DE, keeping a leading zero', () => {
    expect(normalizePostalCode('01067', 'DE')).toBe('01067');
    expect(normalizePostalCode('10115-1234', 'DE')).toBeNull();
  });
  it('rejects letters, 4 or 6 digits and empty values', () => {
    for (const bad of ['abc', '1234', '123456', '', '  ', '1000a']) {
      expect(normalizePostalCode(bad, 'US'), bad).toBeNull();
      expect(normalizePostalCode(bad, 'DE'), bad).toBeNull();
    }
  });
});

describe('stub provider', () => {
  it.each([
    ['US', '10001', [true, true, true]],
    ['US', '94105', [true, true, true]],
    ['US', '60601', [true, false, true]],
    ['US', '73301', [false, true, true]],
    ['US', '59001', [false, false, true]],
    ['US', '99999', [false, false, false]],
    ['DE', '10115', [true, true, true]],
    ['DE', '80331', [true, false, true]],
    ['DE', '01067', [false, true, true]],
    ['DE', '99998', [false, false, false]],
  ] as const)('seeded table %s %s', async (country, zip, [cable, wireless, mobile]) => {
    expect(SEEDED_ZIPS[`${country}:${zip}`]).toBeDefined();
    const answer = await createStubProvider('table').check(zip, country);
    expect(answer.served).toEqual({ cable, 'fixed-wireless': wireless, mobile });
    expect(answer.anyServed).toBe(cable || wireless || mobile);
  });

  it('serves an unknown ZIP everywhere in table mode, everywhere in all mode and nowhere in none mode', async () => {
    expect((await createStubProvider('table').check('12345', 'US')).served).toEqual({ cable: true, 'fixed-wireless': true, mobile: true });
    expect((await createStubProvider('all').check('99999', 'US')).anyServed).toBe(true);
    const none = await createStubProvider('none').check('10001', 'US');
    expect(none.anyServed).toBe(false);
    expect(none.served).toEqual({ cable: false, 'fixed-wireless': false, mobile: false });
  });
});

describe('cached serviceability', () => {
  it('second call within 300 s hits the provider once and keeps checkedAt; at 301 s the provider is called again', async () => {
    let clock = Date.parse('2026-10-07T10:00:00Z');
    const provider: ServiceabilityProvider = { check: vi.fn(createStubProvider('table').check) };
    const service = createCachedServiceability(provider, 300, () => clock);
    const first = await service.check('10001', 'US');
    clock += 299_000;
    const second = await service.check('10001', 'US');
    expect(provider.check).toHaveBeenCalledTimes(1);
    expect(second.checkedAt).toBe(first.checkedAt);
    expect(first.checkedAt).toBe('2026-10-07T10:00:00.000Z');
    clock += 2_000;
    const third = await service.check('10001-9999', 'US');
    expect(provider.check).toHaveBeenCalledTimes(2);
    expect(third.checkedAt).toBe('2026-10-07T10:05:01.000Z');
  });

  it('keeps countries apart and throws RangeError for an invalid ZIP', async () => {
    const service = cached();
    expect((await service.check('10115', 'DE')).country).toBe('DE');
    await expect(service.check('abc', 'US')).rejects.toThrow(RangeError);
  });
});

describe('describeAvailability', () => {
  it('Location not served at all: ZIP 99999 gives state not-served, not an empty catalog', async () => {
    const location = await cached().check('99999', 'US');
    expect(describeAvailability(location)).toEqual({ state: 'not-served', technologies: [] });
  });
  it('reports no-location, served and partially-served with the served technologies', async () => {
    expect(describeAvailability(undefined)).toEqual({ state: 'no-location', technologies: [] });
    expect(describeAvailability(await cached().check('10001', 'US')).state).toBe('served');
    expect(describeAvailability(await cached().check('60601', 'US'))).toEqual({ state: 'partially-served', technologies: ['cable', 'mobile'] });
  });
});
