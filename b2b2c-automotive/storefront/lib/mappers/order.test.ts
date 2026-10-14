// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Order, RecurringOrder } from '@commercetools/platform-sdk';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import enUS from '@/messages/en-US.json';
import deDE from '@/messages/de-DE.json';
import type { Branch } from '@/lib/types';
import { buildTimeline, isPickupOrder, mapOrderStatus, mapOrderView, nextStepSentence, ORDER_STATE_READY_FOR_PICKUP } from './order';

const money = (centAmount: number) => ({ type: 'centPrecision', centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const METHODS = { pickup: 'mau-ship-pickup', standard: 'mau-ship-standard', express: 'mau-ship-express' } as const;

function order(over: Record<string, unknown> = {}, method: keyof typeof METHODS = 'standard'): Order {
  return {
    id: 'o-1',
    version: 3,
    orderNumber: 'MA-7K3M9Q2X',
    customerEmail: 'qa-p1@example.com',
    store: { typeId: 'store', key: 'mau-reseller-north' },
    orderState: 'Open',
    paymentState: 'Paid',
    shipmentState: 'Pending',
    totalPrice: money(11900),
    taxedPrice: { totalNet: money(10000), totalGross: money(11900), totalTax: money(1900), taxPortions: [{ rate: 0.19, amount: money(1900), name: 'DE VAT 19%' }] },
    lineItems: [
      {
        id: 'li-1',
        name: { 'de-DE': 'Bremsscheibe vorne', 'en-US': 'Front brake disc' },
        productSlug: { 'en-US': 'front-brake-disc' },
        quantity: 2,
        price: { value: money(5000) },
        totalPrice: money(10000),
        variant: { sku: 'BRK-1', images: [{ url: 'https://img.example.test/brake.jpg' }], attributes: [{ name: 'brand', value: 'Brembo' }] },
        taxRate: { name: 'DE VAT 19%', amount: 0.19, includedInPrice: true },
      },
    ],
    shippingInfo: { shippingMethodName: 'x', price: money(0), shippingMethod: { typeId: 'shipping-method', id: 'sm', obj: { key: METHODS[method] } } },
    shippingAddress: { firstName: 'Ada', lastName: 'Test', streetName: 'Hauptstr.', streetNumber: '1', postalCode: '10115', city: 'Berlin', country: 'DE' },
    custom: { type: { typeId: 'type', id: 't' }, fields: { pickupBranchKey: 'mau-br-north-berlin' } },
    ...over,
  } as unknown as Order;
}
const branch: Branch = {
  key: 'mau-br-north-berlin',
  channelId: 'ch',
  name: 'Malva Berlin',
  address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' },
  hours: { mon: ['08:00', '18:00'] },
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
};
const ctx = { locale: 'en-US', branch, recurring: null, storeName: 'Malva North', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin', savingFallback: 'Discount' };

// A translator over the real catalogue: only the keys under `order.next` and `order.window` are used here.
function translator(messages: Record<string, unknown>) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], (messages.order as Record<string, unknown>) ?? {});
    const text = typeof raw === 'string' ? raw : `MISSING:${key}`;
    return text
      .replace(/\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}/, (_m, one: string, other: string) => (values.count === 1 ? one : other).replace('#', String(values.count)))
      .replace(/\{(\w+)\}/g, (_m, name: string) => String(values[name] ?? ''));
  };
}
const t = translator(enUS as Record<string, unknown>);

describe('mapOrderStatus', () => {
  it('status placed for new order', () => expect(mapOrderStatus(order())).toBe('placed'));
  it('status ready-for-pickup from state key', () => {
    expect(ORDER_STATE_READY_FOR_PICKUP).toBe('ready-for-pickup');
    expect(mapOrderStatus(order({ state: { typeId: 'state', id: 's', obj: { key: 'ready-for-pickup' } } }, 'pickup'))).toBe('ready-for-pickup');
  });
  it('status shipped', () => expect(mapOrderStatus(order({ shipmentState: 'Shipped' }))).toBe('shipped'));
  it('delivered becomes collected for pickup orders', () => {
    expect(mapOrderStatus(order({ shipmentState: 'Delivered' }, 'pickup'))).toBe('collected');
    expect(mapOrderStatus(order({ shipmentState: 'Delivered' }, 'standard'))).toBe('delivered');
    expect(mapOrderStatus(order({ shipmentState: 'Delivered', state: { typeId: 'state', id: 's', obj: { key: 'ready-for-pickup' } } }, 'pickup'))).toBe('collected');
  });
  it('cancelled', () => expect(mapOrderStatus(order({ orderState: 'Cancelled', shipmentState: 'Shipped' }))).toBe('cancelled'));
});

describe('pickup or shipping', () => {
  it('pickup is decided by the shipping method key not the cart preset', () => {
    // The cart preset said pickup (custom field pickupBranchKey is present) but the shopper chose standard shipping in the hosted page.
    expect(isPickupOrder(order({}, 'standard'))).toBe(false);
    expect(mapOrderView(order({}, 'standard'), ctx).mode).toBe('ship');
    expect(isPickupOrder(order({}, 'pickup'))).toBe(true);
    expect(mapOrderView(order({}, 'pickup'), ctx).mode).toBe('pickup');
  });
});

describe('timeline', () => {
  it('timeline pickup has ready step', () => {
    const steps = buildTimeline(mapOrderView(order({}, 'pickup'), ctx)).steps;
    expect(steps.map((s) => s.key)).toEqual(['received', 'ready', 'collected']);
    expect(steps.map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming']);
  });
  it('timeline ship has shipped step', () => {
    const steps = buildTimeline(mapOrderView(order({ shipmentState: 'Shipped' }), ctx)).steps;
    expect(steps.map((s) => s.key)).toEqual(['received', 'shipped', 'delivered']);
    expect(steps.map((s) => s.state)).toEqual(['done', 'current', 'upcoming']);
  });
  it('a cancelled order has no timeline', () => expect(buildTimeline(mapOrderView(order({ orderState: 'Cancelled' }), ctx)).steps).toEqual([]));
});

describe('next step sentence', () => {
  it('pickup sentence names store and city', () => {
    const text = nextStepSentence(mapOrderView(order({}, 'pickup'), ctx), t);
    expect(text).toContain('Malva Berlin');
    expect(text).toContain('Berlin');
    expect(text).toMatch(/photo ID/i);
  });
  it('shipping sentence includes window from the store ship days', () => {
    const text = nextStepSentence(mapOrderView(order(), ctx), t);
    expect(text).toContain('Malva North');
    expect(text).toContain('2-3 business days');
  });
  it('shipping sentence without window omits it', () => {
    expect(nextStepSentence(mapOrderView(order(), { ...ctx, shipDays: null }), t)).toBe('Shipping from Malva North.');
  });
  it('the express method has no window of its own', () => {
    expect(nextStepSentence(mapOrderView(order({}, 'express'), ctx), t)).toBe('Shipping from Malva North.');
  });
  it('one day window reads singular', () => {
    expect(nextStepSentence(mapOrderView(order(), { ...ctx, shipDays: { min: 1, max: 1 } }), t)).toContain('1 business day');
  });
  it('no sentence promises an email or a text message', () => {
    for (const messages of [enUS, deDE] as Record<string, unknown>[]) {
      const tr = translator(messages);
      for (const status of ['placed', 'ready-for-pickup', 'shipped', 'collected', 'delivered', 'cancelled'] as const) {
        for (const method of ['pickup', 'standard', 'express'] as const) {
          const extra = status === 'ready-for-pickup' ? { state: { typeId: 'state', id: 's', obj: { key: 'ready-for-pickup' } } } : status === 'shipped' ? { shipmentState: 'Shipped' } : status === 'delivered' || status === 'collected' ? { shipmentState: 'Delivered' } : status === 'cancelled' ? { orderState: 'Cancelled' } : {};
          const sentence = nextStepSentence(mapOrderView(order(extra, method), ctx), tr);
          expect(sentence).not.toContain('MISSING');
          expect(sentence).not.toMatch(/e-?mail|text you|texted|sms|per mail|per sms|schreiben|benachrichtig/i);
        }
      }
    }
  });
});

describe('order view', () => {
  it('totals come from taxedPrice', () => {
    const view = mapOrderView(order(), ctx);
    expect(view.totals.total).toMatchObject({ centAmount: 11900, currencyCode: 'EUR' });
    expect(view.totals.tax).toMatchObject({ label: 'VAT (19%)', rate: 0.19, amount: { centAmount: 1900 } });
    expect(view.totals.subtotal.centAmount).toBe(10000);
    expect(view.totals.pricesIncludeTax).toBe(true);
  });
  it('no tax data means no tax line', () => expect(mapOrderView(order({ taxedPrice: undefined }), ctx).totals.tax).toBeNull());
  it('lines carry the localized name, brand and image', () => {
    const line = mapOrderView(order(), { ...ctx, locale: 'de-DE' }).lines[0];
    expect(line).toMatchObject({ name: 'Bremsscheibe vorne', brand: 'Brembo', imageUrl: 'https://img.example.test/brake.jpg', quantity: 2, recurrence: null });
  });
  it('named savings come from the expanded discounts', () => {
    const o = order({
      lineItems: [
        {
          ...(order().lineItems[0] as object),
          price: { value: money(5000), discounted: { value: money(4500), discount: { typeId: 'product-discount', id: 'pd', obj: { key: 'spring', name: { 'en-US': 'Spring sale' } } } } },
        },
      ],
    });
    expect(mapOrderView(o, ctx).totals.savings).toEqual([{ discountId: 'pd', name: 'Spring sale', amount: { centAmount: 1000, currencyCode: 'EUR', fractionDigits: 2 } }]);
  });
  it('shipping details come from the order address', () => {
    expect(mapOrderView(order(), ctx).shipTo).toEqual({ name: 'Ada Test', street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin', country: 'DE' });
    expect(mapOrderView(order({}, 'pickup'), ctx).shipTo).toBeNull();
  });
  it('pickup details come from the branch of the order', () => {
    expect(mapOrderView(order({}, 'pickup'), ctx).pickup).toMatchObject({ branchName: 'Malva Berlin', address: { city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] } });
    expect(mapOrderView(order({}, 'pickup'), { ...ctx, branch: null }).pickup).toBeNull();
  });
  it('payment state wording follows the order payment state', () => {
    expect(mapOrderView(order({ paymentState: 'Paid' }), ctx).payment).toBe('paid');
    expect(mapOrderView(order({ paymentState: 'Pending' }), ctx).payment).toBe('pending');
    expect(mapOrderView(order({ paymentState: undefined }), ctx).payment).toBe('pending');
    expect(mapOrderView(order({ paymentState: 'Failed' }), ctx).payment).toBe('failed');
  });
  it('a customer on the order means no account offer', () => {
    expect(mapOrderView(order(), ctx).hasCustomer).toBe(false);
    expect(mapOrderView(order({ customerId: 'c-1' }), ctx).hasCustomer).toBe(true);
  });
});

describe('subscription block', () => {
  const sub = order({
    lineItems: [
      {
        ...(order().lineItems[0] as object),
        recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp', obj: { key: 'mau-every-3-months', name: { 'en-US': 'Every 3 months' } } } },
      },
    ],
  });
  const recurring = { id: 'ro-1', recurringOrderState: 'Active', nextOrderAt: '2026-12-15T08:00:00.000Z' } as unknown as RecurringOrder;
  it('subscription line shows frequency and next date from the recurring order', () => {
    const view = mapOrderView(sub, { ...ctx, recurring });
    expect(view.lines[0].recurrence).toEqual({ policyName: 'Every 3 months' });
    expect(view.subscription).toEqual({ frequencies: ['Every 3 months'], state: 'scheduled', nextOrderAt: '2026-12-15T08:00:00.000Z' });
  });
  it('subscription without a recurring order yet says being set up and shows no date', () => {
    expect(mapOrderView(sub, ctx).subscription).toEqual({ frequencies: ['Every 3 months'], state: 'setting-up', nextOrderAt: null });
  });
  it('a paused or ended recurring order shows no date', () => {
    expect(mapOrderView(sub, { ...ctx, recurring: { ...recurring, recurringOrderState: 'Paused' } as unknown as RecurringOrder }).subscription).toMatchObject({ state: 'paused', nextOrderAt: null });
    expect(mapOrderView(sub, { ...ctx, recurring: { ...recurring, recurringOrderState: 'Canceled' } as unknown as RecurringOrder }).subscription).toMatchObject({ state: 'ended', nextOrderAt: null });
  });
  it('a one-time order has no subscription block', () => expect(mapOrderView(order(), ctx).subscription).toBeNull());
});

describe('order number', () => {
  it("order number is the order's, never a literal", () => {
    expect(mapOrderView(order({ orderNumber: 'MA-ZZZZZZZZ' }), ctx).number).toBe('MA-ZZZZZZZZ');
    // The page and the order components never carry a number, a currency or a tax rate as a literal.
    const files = ['components/order', 'app/[locale]/[store]/checkout/confirmation'].flatMap((dir) => walk(path.resolve(import.meta.dirname, '../..', dir)));
    for (const file of files.filter((f) => !/\.test\./.test(f))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bAL-|\bMA-\d|#\d{4}/);
      expect(source, file).not.toMatch(/['"`]\$\s?\d|€|\bHST\b|\bVAT\b|\bUSD\b|\bEUR\b|\b19\s?%/);
    }
  });
});

function walk(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  } catch {
    return [];
  }
}
