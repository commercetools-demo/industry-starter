import { postPurchaseNow } from './now';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('postPurchaseNow', () => {
  it('moves forward by DEV_NOW_OFFSET_DAYS in development', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00Z'));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_NOW_OFFSET_DAYS', '6');
    expect(postPurchaseNow().toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });

  it('ignores the offset in production and test', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00Z'));
    vi.stubEnv('DEV_NOW_OFFSET_DAYS', '6');
    vi.stubEnv('NODE_ENV', 'production');
    expect(postPurchaseNow().toISOString()).toBe('2026-10-01T00:00:00.000Z');
    vi.stubEnv('NODE_ENV', 'test');
    expect(postPurchaseNow().toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it.each(['abc', '-1', '401', '2.5', ''])('ignores the invalid value %j in development', (value) => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00Z'));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_NOW_OFFSET_DAYS', value);
    expect(postPurchaseNow().toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});
