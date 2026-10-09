import { createFakeRoot, type FakeRoot } from '../seed/fake-root';

/** A fake project holding one synthetic patient (Sam) with something in every place, and another patient (Alex) who must be left alone. */
export const SAM_ID = 'cust-sam';
export const ALEX_ID = 'cust-alex';
export const SAM_REF = 'pt_8k2m4q7x';
export const ALEX_REF = 'pt_3d9f6w2c';

export function createPrivacyFixture(): FakeRoot {
  const fake = createFakeRoot({
    customers: [
      { id: SAM_ID, email: 'sam.rivera@example.com', firstName: 'Sam', lastName: 'Rivera', custom: { fields: { patientRef: SAM_REF } } },
      { id: ALEX_ID, email: 'alex.chen@example.com', firstName: 'Alex', lastName: 'Chen', custom: { fields: { patientRef: ALEX_REF } } },
    ],
    carts: [
      { id: 'cart-sam', customerId: SAM_ID, paymentInfo: { payments: [{ id: 'pay-sam-card' }] } },
      { id: 'cart-alex', customerId: ALEX_ID },
    ],
    orders: [
      { id: 'ord-sam', customerId: SAM_ID, paymentInfo: { payments: [{ id: 'pay-sam-card' }, { id: 'pay-sam-tender' }] } },
      { id: 'ord-alex', customerId: ALEX_ID },
    ],
    payments: [
      { id: 'pay-sam-card', customer: { typeId: 'customer', id: SAM_ID } },
      { id: 'pay-sam-tender' }, // a tender payment with no customer reference: reachable through the order
      { id: 'pay-alex', customer: { typeId: 'customer', id: ALEX_ID } },
    ],
    reviews: [{ id: 'rev-sam', customer: { typeId: 'customer', id: SAM_ID } }, { id: 'rev-alex', customer: { typeId: 'customer', id: ALEX_ID } }],
    shoppingLists: [{ id: 'list-sam', customer: { typeId: 'customer', id: SAM_ID } }],
    cartDiscounts: [{ id: 'cd-sam', cartPredicate: `customer.id = "${SAM_ID}"` }],
    discountCodes: [{ id: 'dc-sam', code: 'SAM10', cartDiscounts: [{ typeId: 'cart-discount', id: 'cd-sam' }] }, { id: 'dc-all', code: 'ALL' }],
    businessUnits: [
      { id: 'bu-sole', associates: [{ customer: { typeId: 'customer', id: SAM_ID } }] },
      { id: 'bu-shared', associates: [{ customer: { typeId: 'customer', id: SAM_ID } }, { customer: { typeId: 'customer', id: ALEX_ID } }] },
    ],
    quotes: [{ id: 'q-sam', customer: { typeId: 'customer', id: SAM_ID } }],
    quoteRequests: [{ id: 'qr-sam', customer: { typeId: 'customer', id: SAM_ID } }],
    stagedQuotes: [{ id: 'sq-sam', customer: { typeId: 'customer', id: SAM_ID } }],
    messages: [{ id: 'msg-1', resource: { typeId: 'order', id: 'ord-sam' } }, { id: 'msg-2', resource: { typeId: 'order', id: 'ord-alex' } }],
    recurringOrders: [{ id: 'ro-sam', customer: { typeId: 'customer', id: SAM_ID } }],
  });
  const put = (container: string, key: string, value: unknown) => {
    fake.objects.objects.push({ id: `co-${container}-${key}`, container, key, version: 1, value, createdAt: '2026-10-01T00:00:00.000Z', lastModifiedAt: '2026-10-01T00:00:00.000Z' });
  };
  put('malva-rx', 'RX-48213', { number: 'RX-48213', patientRef: SAM_REF, lines: [{ sig: '1 capsule, 3x daily for 7 days' }] });
  put('malva-rx', 'RX-42017', { number: 'RX-42017', patientRef: ALEX_REF, lines: [] });
  put('malva-lab', 'LAB-50301', { id: 'LAB-50301', patientRef: SAM_REF, name: 'Complete blood count', results: [] });
  put('malva-credential', `${SAM_REF}.schedule-iv`, { patientRef: SAM_REF, class: 'schedule-iv' });
  put('malva-booking', 'BK-PATIENT01', { reference: 'BK-PATIENT01', patientRef: SAM_REF, doctorKey: 'mlv-doc-amara-okafor', mode: 'remote', startsAt: '2026-11-05T14:00:00.000Z', reason: 'Annual check-up', status: 'booked' });
  put('malva-booking', 'BK-GUEST0001', { reference: 'BK-GUEST0001', guest: { name: 'Sam Rivera', email: 'sam.rivera@example.com', phone: '+1 212 555 0101' }, doctorKey: 'mlv-doc-amara-okafor', mode: 'office', startsAt: '2026-11-06T14:00:00.000Z', reason: 'Cough', status: 'booked' });
  put('malva-booking', 'BK-ALEX0001', { reference: 'BK-ALEX0001', patientRef: ALEX_REF, doctorKey: 'mlv-doc-amara-okafor', mode: 'remote', startsAt: '2026-11-07T14:00:00.000Z', reason: 'Rash', status: 'booked' });
  put('malva-slot-claim', 'mlv-doc-amara-okafor.remote.20261105T140000Z', { doctorKey: 'mlv-doc-amara-okafor', mode: 'remote', startsAt: '2026-11-05T14:00:00.000Z' });
  put('malva-slot-claim', 'mlv-doc-amara-okafor.office.20261106T140000Z', { doctorKey: 'mlv-doc-amara-okafor', mode: 'office', startsAt: '2026-11-06T14:00:00.000Z' });
  put('malva-slot-claim', 'mlv-doc-amara-okafor.remote.20261107T140000Z', { doctorKey: 'mlv-doc-amara-okafor', mode: 'remote', startsAt: '2026-11-07T14:00:00.000Z' });
  put('malva-schedule', 'mlv-doc-amara-okafor', { weekly: [] });
  put('malva-counter', 'order-number', { next: 2 });
  put('malva-ratelimit', `rl-${SAM_ID}`, { failures: [] });
  put('malva-ratelimit', `rl-${ALEX_ID}`, { failures: [] });
  put('malva-dispense-ledger', 'ord-sam', { orderId: 'ord-sam', patientRef: SAM_REF, lines: [] });
  put('malva-dispense-ledger', 'ord-alex', { orderId: 'ord-alex', patientRef: ALEX_REF, lines: [] });
  put('malva-order-attempt', 'cart-sam_3', { state: 'done', at: '2026-10-01T00:00:00.000Z', orderId: 'ord-sam' });
  put('malva-order-attempt', 'cart-alex_2', { state: 'done', at: '2026-10-01T00:00:00.000Z', orderId: 'ord-alex' });
  put('malva-refill-log', 'ro-sam.20261101050000', { recurringOrderId: 'ro-sam', runAt: '2026-10-31T05:00:00.000Z', runFor: '2026-11-01T05:00:00.000Z', outcome: 'allowed' });
  put('malva-allowance', `${SAM_REF}_2026-10`, { patientRef: SAM_REF, cycle: '2026-10', granted: 5000 });
  put('malva-allowance-ledger', 'ord-sam', { orderId: 'ord-sam', patientRef: SAM_REF });
  return fake;
}
