// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ctCart, lineItem, money } from '@/test/cart-fixtures';
import { formatMoney } from '@/lib/utils';
import type { DeliveryOption } from '@/lib/types';
import { mapCart, taxLabel } from './cart';

const free = { currencyCode: 'EUR', centAmount: 0, fractionDigits: 2 };
const pickup: DeliveryOption = { mode: 'pickup', methodKey: 'mau-ship-pickup', fee: free, freeAbove: null, remainingForFree: null, branch: { key: 'b', name: 'Malva Berlin', city: 'Berlin', pickupPromise: 'today' } };
const stock = { 'BRK-1': { branchQty: 5, masterQty: 50 }, 'FLT-1': { branchQty: 0, masterQty: 10 } };
const ctx = (over: Partial<Parameters<typeof mapCart>[1]> = {}) => ({ locale: 'de-DE', options: [pickup], stock, branchName: 'Malva Berlin', vehicle: null, savingFallback: 'Rabatt', unpricedSkus: [], ...over });

describe('mapCart', () => {
  it('tax line reads VAT (19%) for a German store', () => {
    expect(mapCart(ctCart(), ctx()).totals.tax).toMatchObject({ label: 'VAT (19%)', rate: 0.19 });
  });
  it('tax is null when taxedPrice is absent and the summary says Calculated at checkout', () => {
    expect(mapCart(ctCart({ taxedPrice: undefined }), ctx()).totals.tax).toBeNull();
  });
  it('mixed tax rates give no label and the amount only', () => {
    const cart = ctCart();
    const taxed = { ...cart.taxedPrice!, taxPortions: [{ rate: 0.19, amount: money(100), name: 'VAT' }, { rate: 0.07, amount: money(50), name: 'VAT' }] };
    const tax = mapCart({ ...cart, taxedPrice: taxed }, ctx()).totals.tax;
    expect(tax?.label).toBe('');
    expect(tax?.rate).toBeNull();
  });
  it('totals reconcile: subtotal minus savings plus delivery equals total when prices include tax', () => {
    const { totals } = mapCart(ctCart(), ctx());
    const saved = totals.savings.reduce((s, x) => s + x.amount.centAmount, 0);
    expect(totals.subtotal.centAmount - saved + totals.delivery.centAmount).toBe(totals.total.centAmount);
    expect(totals.pricesIncludeTax).toBe(true);
  });
  it('totals reconcile with net prices: total equals net plus tax', () => {
    const net = 8529;
    const tax = 1621;
    const cart = ctCart({
      lineItems: [{ ...lineItem('li-1', 'BRK-1', 1, { list: net }), taxRate: { name: 'US tax', amount: 0.19, includedInPrice: false, country: 'US' } }],
      totalPrice: money(net),
      taxedPrice: { totalNet: money(net), totalGross: money(net + tax), totalTax: money(tax), taxPortions: [{ rate: 0.19, amount: money(tax), name: 'US tax' }] },
      shippingInfo: undefined,
    });
    const { totals } = mapCart(cart, ctx());
    expect(totals.pricesIncludeTax).toBe(false);
    expect(totals.total.centAmount).toBe(totals.subtotal.centAmount + (totals.tax?.amount.centAmount ?? 0));
  });
  it('a bundle counts as its own units: the locked component lines are listed but not counted (W-11)', () => {
    const bundle = lineItem('p', 'BND-1', 2, { list: 15156 });
    const child = (id: string, sku: string, qty: number) => ({ ...lineItem(id, sku, qty, { list: 0 }), custom: { type: { typeId: 'type', id: 't' }, fields: { parentLineItemId: 'p' } } });
    const cart = ctCart({ lineItems: [bundle, child('k1', 'SK-1', 4), child('k2', 'SK-2', 2)] });
    const mapped = mapCart(cart, ctx({ stock: { ...stock, 'SK-1': { branchQty: 9, masterQty: 0 }, 'SK-2': { branchQty: 9, masterQty: 0 } } }));
    expect(mapped.itemCount).toBe(2);
    expect(mapped.lines.map((l) => [l.id, l.parentLineItemId])).toEqual([['p', undefined], ['k1', 'p'], ['k2', 'p']]);
    expect(mapped.lines[0]).not.toHaveProperty('parentLineItemId');
    // the bundle has no inventory entry: its stock is what its components allow (4 x SK-1 and 2 x SK-2 for 2 bundles; 9 on the shelf each)
    expect(mapped.lines[0].stock).toMatchObject({ available: 2, capped: false });
  });
  it('a bundle with a component out of stock is out of stock itself, so the cart blocks Checkout (W-11)', () => {
    const bundle = lineItem('p', 'BND-1', 2, { list: 15156 });
    const child = (id: string, sku: string, qty: number) => ({ ...lineItem(id, sku, qty, { list: 0 }), custom: { type: { typeId: 'type', id: 't' }, fields: { parentLineItemId: 'p' } } });
    const mapped = mapCart(ctCart({ lineItems: [bundle, child('k1', 'SK-1', 4), child('k2', 'SK-2', 2)] }), ctx({ stock: { 'SK-1': { branchQty: 9, masterQty: 0 }, 'SK-2': { branchQty: 0, masterQty: 0 } } }));
    expect(mapped.lines[0].stock.available).toBe(0);
    expect(mapped.lines[2].stock.available).toBe(0);
  });
  it('item count is the sum of quantities', () => {
    expect(mapCart(ctCart(), ctx()).itemCount).toBe(3);
  });
  it('recurring line maps its policy name and price mode', () => {
    const cart = ctCart({ lineItems: [lineItem('li-9', 'BRK-1', 1, { list: 5000, recurrence: true })] });
    const mapped = mapCart(cart, ctx({ locale: 'en-US' }));
    expect(mapped.lines[0].recurrence).toEqual({ policyKey: 'mau-rp-monthly', policyName: 'Monthly', priceMode: 'Dynamic' });
    expect(mapped.hasSubscription).toBe(true);
  });
  it('recurring note appears only with a subscription line', () => {
    expect(mapCart(ctCart(), ctx()).hasSubscription).toBe(false);
    expect(mapCart(ctCart(), ctx()).lines.every((l) => l.recurrence === null)).toBe(true);
  });
  it('maps the line: brand, slug, image, unit and list price, stock split', () => {
    const [brake, filter] = mapCart(ctCart(), ctx()).lines;
    expect(brake).toMatchObject({ brand: 'Brembo', productSlug: 'BRK-1-de', name: 'Teil BRK-1', imageUrl: 'https://images.example.com/BRK-1.jpg', quantity: 2 });
    expect(brake.unitPrice.centAmount).toBe(4600);
    expect(brake.listUnitPrice?.centAmount).toBe(5000);
    expect(brake.total.centAmount).toBe(9200);
    expect(brake.stock).toEqual({ fromStore: 2, shipsLater: 0, capped: false, available: 2, branchName: 'Malva Berlin' });
    expect(filter.listUnitPrice).toBeNull();
    expect(filter.stock).toMatchObject({ fromStore: 0, shipsLater: 1, capped: false });
  });
  it('an unknown stock reads as capped to zero', () => {
    const line = mapCart(ctCart(), ctx({ stock: {} })).lines[0];
    expect(line.stock).toMatchObject({ available: 0, capped: true });
  });
  it('fit follows the active vehicle', () => {
    const fits = { make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' };
    const other = { make: 'BMW', model: 'X5', year: 2011, engine: '3.0d' };
    expect(mapCart(ctCart(), ctx({ vehicle: fits })).lines[0].fit).toBe('fits');
    expect(mapCart(ctCart(), ctx({ vehicle: other })).lines[0].fit).toBe('does-not-fit');
    expect(mapCart(ctCart(), ctx()).lines[0].fit).toBe('unknown');
  });
  it('selected delivery comes from the shipping method, the pickup field or the shipping info', () => {
    expect(mapCart(ctCart(), ctx()).delivery.selected).toBe('pickup');
    expect(mapCart(ctCart({ custom: undefined }), ctx()).delivery.selected).toBe('ship');
    expect(mapCart(ctCart({ custom: undefined, shippingInfo: undefined }), ctx()).delivery.selected).toBeNull();
    const standard = { ...ctCart().shippingInfo, shippingMethod: { typeId: 'shipping-method', id: 'x', obj: { key: 'mau-ship-standard' } } };
    expect(mapCart(ctCart({ shippingInfo: standard }), ctx()).delivery.selected).toBe('ship');
  });
  it('savings are named from the cart discounts', () => {
    expect(mapCart(ctCart(), ctx({ locale: 'en-US' })).totals.savings.map((s) => s.name)).toEqual(['Brake week −8%', 'Welcome −5%']);
  });
});

describe('taxLabel', () => {
  it.each([
    ['DE VAT 19%', 0.19, 'VAT (19%)'],
    ['US sales tax placeholder 0%', 0, 'Sales tax (0%)'],
    ['MwSt.', 0.19, 'MwSt. (19%)'],
    ['19%', 0.19, ''],
  ])('%s', (name, rate, expected) => {
    expect(taxLabel(name, rate)).toBe(expected);
  });
});

describe('currency formatting uses store locale', () => {
  it('renders 128,45 € for de-DE and $128.45 for en-US', () => {
    expect(formatMoney(12845, 'EUR', 'de-DE').replace(/\s/g, ' ')).toBe('128,45 €');
    expect(formatMoney(12845, 'USD', 'en-US')).toBe('$128.45');
  });
});

describe('lint: nothing hard-coded (D17 and the store configuration rule)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('no HST, CAD or hard-coded 99 threshold in components/cart or the mapper', () => {
    const files = [path.join(root, 'lib/mappers/cart.ts'), ...readdirSync(path.join(root, 'components/cart')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(root, 'components/cart', f))];
    for (const file of files) {
      const text = strip(readFileSync(file, 'utf8'));
      expect(text, file).not.toMatch(/\bHST\b|\bCAD\b|\b99\b/);
      expect(text, file).not.toMatch(/['"`]\$(?!\{)/);
    }
  });
  it('no floor, MAP or minimum price logic in the cart mapper and components', () => {
    const files = [path.join(root, 'lib/mappers/cart.ts'), ...readdirSync(path.join(root, 'components/cart')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(root, 'components/cart', f))];
    for (const file of files) expect(strip(readFileSync(file, 'utf8')), file).not.toMatch(/map-floor|mapFloor|MAP floor|minimumPrice|priceFloor/i);
  });
});
