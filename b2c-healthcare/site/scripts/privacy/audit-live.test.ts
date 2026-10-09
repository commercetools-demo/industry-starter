import { describe, expect, it } from 'vitest';
import { createFakeRoot } from '../seed/fake-root';
import { auditLive, clinicalFixtures } from './audit-live';

const cleanOrder = {
  id: 'ord-1',
  customerId: 'c1',
  lineItems: [{ id: 'li-1', name: { 'en-US': 'Amoxicillin 500 mg capsules' }, custom: { fields: { rxNumber: 'RX-48213', rxLineRef: 'RX-48213-1', prescribedQty: 21, dispensedQty: 21, authorizationParams: '{"issuedAt":"2026-10-02","refillsBefore":0}' } } }],
};

describe('audit-live', () => {
  it('fixtures cover sigs, lab names and notes, result names and booking reasons', () => {
    const f = clinicalFixtures();
    expect(f.some((x) => x.label === 'sig' && x.text.includes('3× daily'))).toBe(true);
    expect(f.some((x) => x.label === 'lab' && x.text === 'Lipid panel')).toBe(true);
    expect(f.some((x) => x.label === 'lab' && x.text === 'LDL cholesterol')).toBe(true);
    expect(f.some((x) => x.label === 'reason' && x.text === 'Annual check-up')).toBe(true);
  });

  it('Order carries a reference not a condition: an order with an RX reference, quantity and medication name is clean', async () => {
    const fake = createFakeRoot({ orders: [cleanOrder], carts: [{ id: 'cart-1', lineItems: cleanOrder.lineItems }], payments: [{ id: 'p1', paymentMethodInfo: { method: 'card' } }], customers: [{ id: 'c1', email: 'sam.rivera@example.com', custom: { fields: { patientRef: 'pt_8k2m4q7x' } } }] });
    const { checked, findings } = await auditLive(fake.root);
    expect(findings).toEqual([]);
    expect(checked).toMatchObject({ order: 1, cart: 1, payment: 1, customer: 1 });
  });

  it('fails when a sig leaks into an order line custom field, naming the resource, path and class but not the value', async () => {
    const leaky = { ...cleanOrder, id: 'ord-leak', lineItems: [{ ...cleanOrder.lineItems[0], custom: { fields: { rxNumber: 'RX-48213', note: 'Take: 1 capsule, 3× daily for 7 days' } } }] };
    const fake = createFakeRoot({ orders: [leaky] });
    const { findings } = await auditLive(fake.root);
    expect(findings).toEqual([{ kind: 'order', id: 'ord-leak', path: 'lineItems[0].custom.fields.note', label: 'sig' }]);
    expect(JSON.stringify(findings)).not.toContain('capsule');
  });

  it('fails on a lab name in a payment or customer, and a booking reason in a cart note', async () => {
    const fake = createFakeRoot({
      payments: [{ id: 'p-leak', paymentMethodInfo: { name: { en: 'Lipid panel' } } }],
      customers: [{ id: 'c-leak', custom: { fields: { patientRef: 'pt_x', diagnosisNote: 'x' } } }],
      carts: [{ id: 'cart-leak', custom: { fields: { memo: 'for my annual check-up' } } }],
    });
    const { findings } = await auditLive(fake.root);
    expect(findings.map((f) => `${f.kind}:${f.label}`).sort()).toEqual(['cart:reason', 'customer:field-name', 'payment:lab']);
  });

  it('is read-only', async () => {
    const fake = createFakeRoot({ orders: [cleanOrder] });
    await auditLive(fake.root);
    expect(fake.log).toEqual([]);
  });
});
