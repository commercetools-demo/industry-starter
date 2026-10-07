// @vitest-environment node
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { cartOffersByKey } from '@/lib/cart/__fixtures__/offers';
import { NOVA_5G_OFFER, NOVA_PRO_OFFER } from '@/lib/devices/__fixtures__/offers';
import { ctCart } from '@/test/fixtures/ctCart';
import { mapCart, type CartMapDeps } from './cart';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' } as const;
const deps = (): CartMapDeps => ({
  offersByKey: { ...cartOffersByKey(), [NOVA_PRO_OFFER.key]: NOVA_PRO_OFFER, [NOVA_5G_OFFER.key]: NOVA_5G_OFFER },
  stock: { 'MLV-DEV-NOVAPRO-BLK-256': 10, 'MLV-DEV-NOVAPRO-BLK-512': 10 },
  issues: [],
  today: '2026-10-07',
  discountKeyById: {},
});

const PRO = 'malva-offer-phone-nova-pro';
const outrightLine = { id: 'D1', sku: 'MLV-DEV-NOVAPRO-BLK-256', offerKey: PRO, price: 100800 };
const financedLine = { id: 'D2', sku: 'MLV-DEV-NOVAPRO-BLK-512', offerKey: PRO, price: 4950, mode: 'Fixed' as const };

/** The cart with the acquisition fields the device route writes onto the lines. */
function withFields(cart: CtCart, fields: Record<string, Record<string, unknown>>): CtCart {
  for (const line of cart.lineItems) Object.assign((line.custom?.fields ?? {}) as Record<string, unknown>, fields[line.id] ?? {});
  return cart;
}

describe('device lines in the mapped cart', () => {
  it('Mixed modes in one order: outright and installments lines each carry their own acquisition', () => {
    const cart = mapCart(
      withFields(ctCart({ lines: [outrightLine, financedLine] }), {
        D1: { acquisitionMode: 'outright', acquisitionTermMonths: 0, acquisitionEndOfTerm: 'owned' },
        D2: { acquisitionMode: 'installments', acquisitionTermMonths: 24, acquisitionEndOfTerm: 'owned-after-final-payment' },
      }),
      ctx,
      deps(),
    );
    const [first, second] = cart.lines;
    expect(first).toMatchObject({ id: 'D1', kind: 'device', chargeType: 'one-time', acquisition: { mode: 'outright', termMonths: 0, endOfTerm: 'owned' } });
    expect(second).toMatchObject({ id: 'D2', kind: 'device', chargeType: 'recurring', acquisition: { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' } });
    expect(cart.summary.devicesMonthly.centAmount).toBe(4950);
    expect(cart.summary.oneTime.centAmount).toBe(100800);
    expect(cart.summary.total.centAmount).toBe(105750);
  });

  it('a line with a misleading price but mode installments still reads installments (the mode is never inferred from the price)', () => {
    // the line fell back to the outright price: one-time chargeType, a big number, and still an installments line
    const cart = mapCart(withFields(ctCart({ lines: [outrightLine] }), { D1: { acquisitionMode: 'installments', acquisitionTermMonths: 36 } }), ctx, deps());
    expect(cart.lines[0]?.acquisition).toMatchObject({ mode: 'installments', termMonths: 36 });
    expect(cart.lines[0]?.chargeType).toBe('one-time');
  });

  it('a financed device line is not a service line: no malva-monthly recurrence is claimed for it', () => {
    const cart = mapCart(withFields(ctCart({ lines: [financedLine] }), { D2: { acquisitionMode: 'lease', acquisitionTermMonths: 24 } }), ctx, deps());
    expect(cart.lines[0]?.recurrence).toBeNull();
    expect(cart.lines[0]?.acquisition).toMatchObject({ mode: 'lease', endOfTerm: 'return' });
  });

  it('carries the financing decision and the end date once they are recorded; lines without fields have no acquisition', () => {
    const cart = mapCart(
      withFields(ctCart({ lines: [financedLine, { id: 'P1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed' as const }] }), {
        D2: { acquisitionMode: 'installments', acquisitionTermMonths: 24, financingDecisionId: 'stub-0000abcd', acquisitionEndDate: '2028-09-07' },
      }),
      ctx,
      deps(),
    );
    expect(cart.lines.find((line) => line.id === 'D2')?.acquisition).toMatchObject({ financingDecisionId: 'stub-0000abcd', endDate: '2028-09-07' });
    expect(cart.lines.find((line) => line.id === 'P1')?.acquisition).toBeUndefined();
  });
});
