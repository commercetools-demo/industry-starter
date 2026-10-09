import { describe, expect, it } from 'vitest';
import { PRIVACY_CONTAINERS } from './inventory';
import { assertOutsideRepo, GDPR_KINDS } from './lib';
import { subjectAccess } from './subject-access';
import { createPrivacyFixture, SAM_ID } from './test-fixture';

/** The "Retrieval of collected data" list of docs.commercetools.com/api/gdpr, verified against the documentation (X, 2026-10-08). */
const GDPR_LIST = ['Customer', 'Cart', 'Order', 'Payment', 'Review', 'ShoppingList', 'DiscountCode', 'CustomObject', 'Message', 'BusinessUnit', 'Quote', 'QuoteRequest', 'StagedQuote'];

describe('subject-access', () => {
  it('Subject access is complete: the kinds queried equal the GDPR list (13), and the report has an entry for each', async () => {
    expect([...GDPR_KINDS]).toEqual(GDPR_LIST);
    const fake = createPrivacyFixture();
    const report = await subjectAccess(fake.root, SAM_ID);
    expect(Object.keys(report!.resources)).toEqual(GDPR_LIST);
    const queried = new Set(report!.queries.map((q) => q.kind));
    for (const kind of GDPR_LIST) expect(queried.has(kind), kind).toBe(true);
  });

  it('Subject access is complete: custom-held data is included, from every malva-* container', async () => {
    const fake = createPrivacyFixture();
    const report = await subjectAccess(fake.root, SAM_ID);
    expect(Object.keys(report!.customObjects).sort()).toEqual([...PRIVACY_CONTAINERS].sort());
    const co = report!.customObjects;
    expect(co['malva-booking'].map((o) => o.key).sort()).toEqual(['BK-GUEST0001', 'BK-PATIENT01']);
    expect(co['malva-rx'].map((o) => o.key)).toEqual(['RX-48213']);
    expect(co['malva-lab'].map((o) => o.key)).toEqual(['LAB-50301']);
    expect(co['malva-credential']).toHaveLength(1);
    expect(co['malva-dispense-ledger'].map((o) => o.key)).toEqual(['ord-sam']);
    expect(co['malva-allowance']).toHaveLength(1);
    expect(co['malva-ratelimit']).toHaveLength(1);
    expect(co['malva-order-attempt'].map((o) => o.key)).toEqual(['cart-sam_3']);
    expect(co['malva-refill-log']).toHaveLength(1);
  });

  it('finds Sam\'s orders, payments (including the order-only tender payment), discount codes through their cart discount, messages and recurring orders, and not Alex\'s', async () => {
    const fake = createPrivacyFixture();
    const report = await subjectAccess(fake.root, 'sam.rivera@example.com');
    const ids = (k: string) => report!.resources[k].map((r) => r.id).sort();
    expect(ids('Customer')).toEqual([SAM_ID]);
    expect(ids('Cart')).toEqual(['cart-sam']);
    expect(ids('Order')).toEqual(['ord-sam']);
    expect(ids('Payment')).toEqual(['pay-sam-card', 'pay-sam-tender']);
    expect(ids('Review')).toEqual(['rev-sam']);
    expect(ids('ShoppingList')).toEqual(['list-sam']);
    expect(ids('DiscountCode')).toEqual(['dc-sam']);
    expect(ids('BusinessUnit')).toEqual(['bu-shared', 'bu-sole']);
    expect(ids('Quote')).toEqual(['q-sam']);
    expect(ids('QuoteRequest')).toEqual(['qr-sam']);
    expect(ids('StagedQuote')).toEqual(['sq-sam']);
    expect(ids('Message')).toEqual(['msg-1']);
    expect(report!.recurringOrders.map((r) => r.id)).toEqual(['ro-sam']);
  });

  it('does not write anything', async () => {
    const fake = createPrivacyFixture();
    await subjectAccess(fake.root, SAM_ID);
    expect(fake.log).toEqual([]);
    expect(fake.objects.calls.some((c) => c.op === 'post' || c.op === 'delete')).toBe(false);
  });

  it('an unknown customer gives no report', async () => {
    expect(await subjectAccess(createPrivacyFixture().root, 'nobody')).toBeNull();
  });

  it('refuses a report path inside the repository', () => {
    expect(() => assertOutsideRepo(`${__dirname}/report.json`)).toThrow(/outside the repository/);
    expect(assertOutsideRepo('/tmp/malva-report.json')).toBe('/tmp/malva-report.json');
  });
});
