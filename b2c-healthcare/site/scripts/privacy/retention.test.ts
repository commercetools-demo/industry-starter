import { describe, expect, it } from 'vitest';
import { createFakeRoot } from '../seed/fake-root';
import { runRetention } from './retention';
import { handleRetention, RETENTION_SECRET_HEADER } from './retention-handler';

const NOW = new Date('2026-12-01T12:00:00.000Z');
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
const opts = (dryRun = false) => ({ dryRun, log: () => {}, sleep: async () => {} });

function project() {
  const fake = createFakeRoot();
  const put = (container: string, key: string, value: unknown) => {
    fake.objects.objects.push({ id: `${container}-${key}`, container, key, version: 1, value, createdAt: iso(-200), lastModifiedAt: iso(-200) });
  };
  const booking = (ref: string, v: Record<string, unknown>) => put('malva-booking', ref, { reference: ref, doctorKey: 'mlv-doc-a', mode: 'remote', status: 'booked', reason: 'Cough', ...v });
  // guest bookings: one expired, one still valid
  booking('BK-GUESTOLD', { guest: { name: 'G', email: 'g@example.com', phone: '+1 212 555 0100' }, startsAt: iso(-100), expiresAt: iso(-10) });
  booking('BK-GUESTNEW', { guest: { name: 'G', email: 'h@example.com', phone: '+1 212 555 0100' }, startsAt: iso(2), expiresAt: iso(92) });
  // patient bookings: cancelled long ago, cancelled recently, completed long ago
  booking('BK-CANCELOLD', { patientRef: 'pt_a', phone: '+1 212 555 0101', startsAt: iso(-120), status: 'cancelled' });
  booking('BK-CANCELNEW', { patientRef: 'pt_a', phone: '+1 212 555 0101', startsAt: iso(-10), status: 'cancelled' });
  booking('BK-DONEOLD', { patientRef: 'pt_a', phone: '+1 212 555 0101', startsAt: iso(-300), status: 'completed' });
  // claims: the expired guest booking's claim, a stale one, a future one
  const claimKey = (d: number) => `mlv-doc-a.remote.${iso(d).replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
  put('malva-slot-claim', claimKey(-100), { startsAt: iso(-100) });
  put('malva-slot-claim', claimKey(-30), { startsAt: iso(-30) });
  put('malva-slot-claim', claimKey(2), { startsAt: iso(2) });
  put('malva-ratelimit', 'rl-old', { failures: [NOW.getTime() - 3_600_000] });
  put('malva-ratelimit', 'rl-live', { failures: [NOW.getTime() - 60_000] });
  put('malva-order-attempt', 'cart-1_2', { state: 'done', at: iso(-40) });
  put('malva-order-attempt', 'cart-2_2', { state: 'done', at: iso(-3) });
  put('malva-refill-log', 'ro.1', { recurringOrderId: 'ro', runAt: iso(-200), outcome: 'allowed' });
  put('malva-refill-log', 'ro.2', { recurringOrderId: 'ro', runAt: iso(-20), outcome: 'allowed' });
  return { fake, claimKey };
}

const keys = (fake: ReturnType<typeof createFakeRoot>, container: string) => fake.objects.objects.filter((o) => o.container === container).map((o) => o.key).sort();

describe('retention', () => {
  it('Retention expires with the basis: an expired guest booking is deleted with its claim, a valid one stays', async () => {
    const { fake, claimKey } = project();
    const result = await runRetention(fake.root, NOW, opts());
    expect(result.guestBookingsDeleted).toBe(1);
    expect(keys(fake, 'malva-booking')).not.toContain('BK-GUESTOLD');
    expect(keys(fake, 'malva-booking')).toContain('BK-GUESTNEW');
    expect(keys(fake, 'malva-slot-claim')).toEqual([claimKey(2)]); // the guest's claim and the stale one are gone, the future one stays
  });

  it('Retention expires with the basis: a cancelled patient booking is de-identified 90 days after the visit, nothing else is touched', async () => {
    const { fake } = project();
    const result = await runRetention(fake.root, NOW, opts());
    expect(result.cancelledBookingsDeidentified).toBe(1);
    const get = (k: string) => fake.objects.objects.find((o) => o.key === k)!.value as Record<string, unknown>;
    expect(get('BK-CANCELOLD')).toMatchObject({ reason: '[removed]', patientRef: 'pt_a', status: 'cancelled' });
    expect(get('BK-CANCELOLD')).not.toHaveProperty('phone');
    expect(get('BK-CANCELNEW')).toMatchObject({ reason: 'Cough', phone: '+1 212 555 0101' });
    expect(get('BK-DONEOLD')).toMatchObject({ reason: 'Cough' });
  });

  it('removes stale rate limits, attempt locks and refill logs only', async () => {
    const { fake } = project();
    const result = await runRetention(fake.root, NOW, opts());
    expect(result).toMatchObject({ rateLimitsDeleted: 1, orderAttemptsDeleted: 1, refillLogsDeleted: 1 });
    expect(keys(fake, 'malva-ratelimit')).toEqual(['rl-live']);
    expect(keys(fake, 'malva-order-attempt')).toEqual(['cart-2_2']);
    expect(keys(fake, 'malva-refill-log')).toEqual(['ro.2']);
  });

  it('every delete carries dataErasure=true', async () => {
    const { fake } = project();
    await runRetention(fake.root, NOW, opts());
    const deletes = fake.objects.calls.filter((c) => c.op === 'delete');
    expect(deletes.length).toBeGreaterThan(5);
    expect(deletes.every((c) => c.dataErasure === true)).toBe(true);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { fake } = project();
    await runRetention(fake.root, NOW, opts());
    const second = await runRetention(fake.root, NOW, opts());
    expect(second).toMatchObject({ guestBookingsDeleted: 0, cancelledBookingsDeidentified: 0, slotClaimsDeleted: 0, rateLimitsDeleted: 0, orderAttemptsDeleted: 0, refillLogsDeleted: 0 });
  });

  it('dry run counts but writes nothing', async () => {
    const { fake } = project();
    const before = fake.objects.objects.length;
    const result = await runRetention(fake.root, NOW, opts(true));
    expect(result.guestBookingsDeleted).toBe(1);
    expect(fake.objects.objects).toHaveLength(before);
    expect(fake.objects.calls.some((c) => c.op === 'delete' || c.op === 'post')).toBe(false);
  });

  it('logs counts only, never a key or a value', async () => {
    const { fake } = project();
    const lines: string[] = [];
    await runRetention(fake.root, NOW, { sleep: async () => {}, log: (l) => lines.push(l) });
    expect(lines.join('\n')).not.toMatch(/BK-|example\.com|Cough|pt_/);
  });
});

describe('retention function guard', () => {
  const deps = (run = async () => ({ dryRun: false, guestBookingsDeleted: 2, cancelledBookingsDeidentified: 0, slotClaimsDeleted: 0, rateLimitsDeleted: 0, orderAttemptsDeleted: 0, refillLogsDeleted: 0 })) => ({ secret: 's3cret-value-1234', run });
  const req = (headers: Record<string, string> = {}, method = 'POST') => new Request('https://x.test/.netlify/functions/retention', { method, headers });

  it('without a configured secret the function is closed and runs nothing', async () => {
    let ran = false;
    const res = await handleRetention(req({ [RETENTION_SECRET_HEADER]: 'x' }), { secret: undefined, run: async () => { ran = true; throw new Error('no'); } });
    expect(res.status).toBe(503);
    expect(ran).toBe(false);
  });

  it('rejects a missing or wrong secret and a GET', async () => {
    expect((await handleRetention(req(), deps())).status).toBe(401);
    expect((await handleRetention(req({ [RETENTION_SECRET_HEADER]: 'wrong' }), deps())).status).toBe(401);
    expect((await handleRetention(req({ [RETENTION_SECRET_HEADER]: 's3cret-value-1234' }, 'GET'), deps())).status).toBe(405);
  });

  it('runs with the secret and answers counts only', async () => {
    const res = await handleRetention(req({ [RETENTION_SECRET_HEADER]: 's3cret-value-1234' }), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, guestBookingsDeleted: 2 });
  });

  it('a failing run answers 502 without detail', async () => {
    const res = await handleRetention(req({ [RETENTION_SECRET_HEADER]: 's3cret-value-1234' }), deps(async () => { throw new Error('secret detail'); }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret detail');
  });
});
