import { describe, expect, it } from 'vitest';
import { erasePatient } from './erase-patient';
import { ALEX_ID, ALEX_REF, createPrivacyFixture, SAM_ID } from './test-fixture';

const opts = (o: { dryRun?: boolean; confirm?: string } = {}) => ({ dryRun: o.dryRun ?? false, confirm: o.confirm, log: () => {}, sleep: async () => {} });

describe('erase-patient', () => {
  it('Erasure reaches derived copies: every DELETE (resources and custom objects) carries dataErasure=true, never a plain DELETE', async () => {
    const fake = createPrivacyFixture();
    await erasePatient(fake.root, SAM_ID, opts({ confirm: SAM_ID }));
    const deletes = fake.log.filter((l) => l.op === 'delete');
    expect(deletes.length).toBeGreaterThan(5);
    expect(deletes.every((d) => d.dataErasure === true)).toBe(true);
    const objectDeletes = fake.objects.calls.filter((c) => c.op === 'delete');
    expect(objectDeletes.length).toBeGreaterThan(8);
    expect(objectDeletes.every((c) => c.dataErasure === true)).toBe(true);
  });

  it('deletes every resource kind of the patient and leaves the other patient alone', async () => {
    const fake = createPrivacyFixture();
    const report = await erasePatient(fake.root, SAM_ID, opts({ confirm: SAM_ID }));
    const ids = (kind: string) => fake.store[kind].map((r) => r.id);
    expect(ids('customers')).toEqual([ALEX_ID]);
    expect(ids('carts')).toEqual(['cart-alex']);
    expect(ids('orders')).toEqual(['ord-alex']);
    expect(ids('payments')).toEqual(['pay-alex']); // including the tender payment reachable only through the order
    expect(ids('reviews')).toEqual(['rev-alex']);
    expect(ids('shoppingLists')).toEqual([]);
    expect(ids('quotes')).toEqual([]);
    expect(ids('quoteRequests')).toEqual([]);
    expect(ids('stagedQuotes')).toEqual([]);
    expect(ids('discountCodes')).toEqual(['dc-all']);
    expect(ids('businessUnits')).toEqual(['bu-shared']);
    expect(fake.store.businessUnits[0].associates).toHaveLength(1);
    expect(report?.deleted.at(-1)).toEqual({ kind: 'Customer', id: SAM_ID }); // customer last
  });

  it('removes the patient from every malva-* container: ref, guest email, rate limit, cart lock, refill log, the booking claim', async () => {
    const fake = createPrivacyFixture();
    await erasePatient(fake.root, SAM_ID, opts({ confirm: SAM_ID }));
    const left = fake.objects.objects.map((o) => `${o.container}/${o.key}`).sort();
    expect(left).toEqual([
      'malva-booking/BK-ALEX0001',
      'malva-counter/order-number',
      'malva-dispense-ledger/ord-alex',
      'malva-order-attempt/cart-alex_2',
      'malva-ratelimit/rl-cust-alex',
      'malva-rx/RX-42017',
      'malva-schedule/mlv-doc-amara-okafor',
      'malva-slot-claim/mlv-doc-amara-okafor.remote.20261107T140000Z',
    ]);
    expect(left.join(' ')).not.toContain(ALEX_REF + 'x');
  });

  it('cancels recurring orders (no dataErasure DELETE exists for them) and reports them', async () => {
    const fake = createPrivacyFixture();
    const report = await erasePatient(fake.root, SAM_ID, opts({ confirm: SAM_ID }));
    expect(fake.store.recurringOrders[0].recurringOrderState).toEqual({ type: 'canceled', reason: 'erasure' });
    expect(report?.notErasable.map((n) => n.kind).sort()).toEqual(['BusinessUnit', 'RecurringOrder']);
  });

  it('resolves an email, case-insensitively', async () => {
    const fake = createPrivacyFixture();
    const report = await erasePatient(fake.root, 'Sam.Rivera@Example.com', opts({ confirm: SAM_ID }));
    expect(report?.customerId).toBe(SAM_ID);
  });

  it('dry run writes nothing and lists what would go', async () => {
    const fake = createPrivacyFixture();
    const before = fake.objects.objects.length;
    const report = await erasePatient(fake.root, SAM_ID, opts({ dryRun: true }));
    expect(fake.log).toEqual([]);
    expect(fake.objects.calls.some((c) => c.op === 'delete')).toBe(false);
    expect(fake.objects.objects).toHaveLength(before);
    expect(report?.deleted.length).toBeGreaterThan(15);
  });

  it('a real run without the matching --confirm is refused before anything is deleted', async () => {
    const fake = createPrivacyFixture();
    await expect(erasePatient(fake.root, SAM_ID, opts())).rejects.toThrow(/--confirm cust-sam/);
    await expect(erasePatient(fake.root, SAM_ID, opts({ confirm: ALEX_ID }))).rejects.toThrow(/Refusing/);
    expect(fake.log).toEqual([]);
  });

  it('an unknown customer erases nothing', async () => {
    const fake = createPrivacyFixture();
    expect(await erasePatient(fake.root, 'nobody', opts({ confirm: 'nobody' }))).toBeNull();
  });

  it('refuses a malformed id (no predicate injection)', async () => {
    const fake = createPrivacyFixture();
    await expect(erasePatient(fake.root, 'x" or id!="', opts({ dryRun: true }))).rejects.toThrow(/does not look like an id/);
  });

  it('refuses a project that is not the seed project', async () => {
    const { assertProject } = await import('./lib');
    const { createFakeRoot } = await import('../seed/fake-root');
    await expect(assertProject(createFakeRoot({}, 'some-production-project').root)).rejects.toThrow(/Refusing/);
  });

  it('logs ids only: no email, name or value', async () => {
    const fake = createPrivacyFixture();
    const lines: string[] = [];
    await erasePatient(fake.root, SAM_ID, { dryRun: true, log: (l) => lines.push(l), sleep: async () => {} });
    const text = lines.join('\n');
    expect(text).not.toMatch(/example\.com|Rivera|Annual check-up|capsule/);
  });
});
