// Live probe for workstream V (V-01). Creates ONE throw-away cart (deleteDaysAfterLastModification 1) and reads one
// custom object. Writes names, counts, statuses and error codes only (no ids of customers, no secrets, no bodies) to
// plans/evidence/V/V-01-probe.txt. Run: npm run test:live -- preset-bundle-probe
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiRoot } from '@/lib/ct/client';

const COMPONENT = 'MCF-GFT-DISCOVERY';
const BUNDLE = '998674532';
const BUNDLE_REF = '9790d294-a6c3-4a54-9391-841b1a7ab85a';
const LINE_TYPE = { typeId: 'type' as const, key: 'mcf-line-fulfilment' };
const out: string[] = [];
const say = (s: string) => out.push(s);

function errInfo(e: unknown): string {
  const x = e as { statusCode?: number; body?: { errors?: { code?: string; message?: string }[] }; message?: string };
  const errors = x.body?.errors ?? [];
  const codes = errors.map((r) => r.code).join(',') || '-';
  const message = (errors[0]?.message ?? x.message ?? '').replace(/\s+/g, ' ').slice(0, 220);
  return `status=${x.statusCode ?? '?'} codes=${codes} message="${message}"`;
}

type Cart = { id: string; version: number; lineItems: { id: string; key?: string; productId: string; quantity: number; price?: { value: { centAmount: number } }; priceMode?: string; custom?: { fields: Record<string, unknown> }; variant?: { sku?: string } }[] };

async function update(cart: Cart, actions: unknown[]): Promise<Cart> {
  const { body } = await apiRoot.carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions: actions as never } }).execute();
  return body as unknown as Cart;
}
const linesOf = (cart: Cart, sku: string) => cart.lineItems.filter((l) => l.variant?.sku === sku);

describe('preset bundle probe (V-01)', () => {
  it('records the platform facts for the bundle design', async () => {
    const { body: created } = await apiRoot.carts().post({ body: { currency: 'USD', country: 'US', deleteDaysAfterLastModification: 1 } }).execute();
    let cart = created as unknown as Cart;
    say(`cart created: lines=${cart.lineItems.length}`);

    // (1) the bundle SKU with a key and an external price. Expected to fail until the owner sets the tax category (OA-V-d).
    try {
      cart = await update(cart, [{ action: 'addLineItem', sku: BUNDLE, quantity: 1, key: 'bundle-probe-1', externalPrice: { currencyCode: 'USD', centAmount: 34916 } }]);
      say(`(1) addLineItem bundle SKU with key and externalPrice: OK, lines of bundle=${linesOf(cart, BUNDLE).length}, key=${linesOf(cart, BUNDLE)[0]?.key}`);
    } catch (e) {
      say(`(1) addLineItem bundle SKU with key and externalPrice: FAILED ${errInfo(e)}`);
    }

    // (2) two adds of one component SKU, same external price, different custom fields (one with parentId): two lines.
    cart = await update(cart, [
      { action: 'addLineItem', sku: COMPONENT, quantity: 1, key: 'probe-child-a', externalPrice: { currencyCode: 'USD', centAmount: 0 }, custom: { type: LINE_TYPE, fields: { parentId: 'bundle-probe-1', brand: 'malva-coffee', fulfilment: 'delivery' } } },
      { action: 'addLineItem', sku: COMPONENT, quantity: 1, externalPrice: { currencyCode: 'USD', centAmount: 0 }, custom: { type: LINE_TYPE, fields: { brand: 'malva-coffee', fulfilment: 'delivery' } } },
    ]);
    say(`(2) two adds of ${COMPONENT} with different custom fields: lines=${linesOf(cart, COMPONENT).length} (expect 2)`);

    // (3) recalculate with updateProductData keeps the external price.
    const before = linesOf(cart, COMPONENT).map((l) => l.price?.value.centAmount);
    cart = await update(cart, [{ action: 'recalculate', updateProductData: true }]);
    const after = linesOf(cart, COMPONENT).map((l) => l.price?.value.centAmount);
    say(`(3) recalculate updateProductData: prices before=${before.join(',')} after=${after.join(',')} priceModes=${linesOf(cart, COMPONENT).map((l) => l.priceMode).join(',')}`);

    // (4) setLineItemPrice changes an external price.
    const line = linesOf(cart, COMPONENT)[0];
    cart = await update(cart, [{ action: 'setLineItemPrice', lineItemId: line.id, externalPrice: { currencyCode: 'USD', centAmount: 150 } }]);
    const changed = cart.lineItems.find((l) => l.id === line.id);
    say(`(4) setLineItemPrice external: price now=${changed?.price?.value.centAmount} priceMode=${changed?.priceMode}`);

    // (5) reading the bundle's custom object with the storefront client: 403 until OA-V-a adds the scope.
    try {
      const { body } = await apiRoot.customObjects().get({ queryArgs: { where: `id="${BUNDLE_REF}"`, limit: 1 } }).execute();
      say(`(5) custom object read: OK results=${body.results.length}`);
    } catch (e) {
      say(`(5) custom object read: FAILED ${errInfo(e)} (expected 403 until OA-V-a)`);
    }

    // (6) Q-V-17, the store channel on the bundle parent: not an order. The line is only added to the cart. The result
    // is recorded whether or not the add succeeds; no order is created (no live order without the owner's consent).
    const channels = (await apiRoot.channels().get({ queryArgs: { limit: 50 } }).execute()).body.results;
    const store = channels.find((c) => c.key?.startsWith('mcf-store'));
    say(`(6) store channel found: ${store ? 'yes' : 'no'}`);
    if (store) {
      try {
        cart = await update(cart, [{ action: 'addLineItem', sku: BUNDLE, quantity: 1, key: 'bundle-probe-store', externalPrice: { currencyCode: 'USD', centAmount: 34916 }, supplyChannel: { typeId: 'channel', id: store.id } }]);
        say(`(6) addLineItem bundle SKU with store supplyChannel: OK`);
      } catch (e) {
        say(`(6) addLineItem bundle SKU with store supplyChannel: FAILED ${errInfo(e)}`);
      }
    }
    expect(cart.id).toBeTruthy();

    mkdirSync(join(process.cwd(), '..', 'plans', 'evidence', 'V'), { recursive: true });
    writeFileSync(join(process.cwd(), '..', 'plans', 'evidence', 'V', 'V-01-probe.txt'), `${out.join('\n')}\n`);
  }, 60000);
});
