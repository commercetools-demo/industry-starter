import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRxFixtures } from '@/lib/ct/fixtures';
import { fixtureCustomerId, fixturePatient, fixturePrescriptionSource, fixtureRateLimit, fixtureSupply } from '@/lib/ct/rx-fixtures';

afterEach(() => vi.unstubAllEnvs());

describe('development fixtures for /prescriptions', () => {
  it('are off unless MALVA_FIXTURES=1, and never loaded in production', async () => {
    vi.stubEnv('MALVA_FIXTURES', '');
    expect(await loadRxFixtures()).toBeNull();
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await loadRxFixtures()).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    expect(await loadRxFixtures()).not.toBeNull();
  });

  it('serve Sam Rivera prescriptions from the seed: RX-48213 without refills, RX-77102 with 3', async () => {
    const patient = fixturePatient(fixtureCustomerId('sam-rivera'));
    expect(patient).toMatchObject({ name: 'Sam Rivera' });
    const own = await fixturePrescriptionSource.listForPatient(patient!.patientRef);
    expect(own.map((r) => [r.number, r.refillsLeft])).toEqual([['RX-48213', 0], ['RX-77102', 3]]);
    expect(fixturePatient('someone-else')).toBeNull();
  });

  it('report stock and the short-dated demo expiry', () => {
    const supply = fixtureSupply(['MED-famotidine-20-mg', 'MED-ibuprofen-400-mg']);
    expect(supply.get('MED-famotidine-20-mg')?.expiryDate).toBe('2026-11-15');
    expect(supply.get('MED-ibuprofen-400-mg')).toMatchObject({ available: 600 });
  });

  it('limit lookups like the real limiter: 5 failures, then limited', async () => {
    for (let i = 0; i < 4; i += 1) expect((await fixtureRateLimit.recordFailure('fx')).limited).toBe(false);
    expect((await fixtureRateLimit.recordFailure('fx')).limited).toBe(true);
    expect((await fixtureRateLimit.status('fx')).retryAfterSeconds).toBeGreaterThan(0);
    expect((await fixtureRateLimit.status('other')).limited).toBe(false);
  });
});
