// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The route tests' fake cart engine has the external-price behaviours of a preset bundle (workstream V, F-V-02, F-V-03).
import { beforeEach, describe, expect, it } from 'vitest';
import { clientModule, fake, seedCart } from '@/test/fake-carts';

const BUNDLE_SKU = '998674532'; // the bundle product: no price of its own, so only an external price can be on its line
const PART_SKU = 'MCF-GFT-STARTER';
const KEY = 'bundle-11111111-2222-4333-8444-555555555555';
const fields = (extra: Record<string, unknown>) => ({
  type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'delivery', brand: 'malva-coffee', ...extra },
});

interface LineView {
  id: string; key?: string; quantity: number; variant: { sku: string }; price: { value: { centAmount: number } }; priceMode?: string;
  custom?: { fields: { parentId?: string } };
}

/** One cart update as the storefront sends it: the version is read from the fake first. */
async function update(id: string, actions: Record<string, unknown>[]): Promise<{ lineItems: LineView[] }> {
  const version = fake.carts.get(id)?.version as number;
  const { body } = await clientModule().apiRoot.carts().withId({ ID: id }).post({ body: { version, actions } }).execute();
  return body as { lineItems: LineView[] };
}

describe('fake cart: external prices of a preset bundle (workstream V)', () => {
  beforeEach(() => {
    fake.prices[PART_SKU] = 17900;
  });

  it('a fake-cart add with externalPrice keeps that price', async () => {
    const id = seedCart();
    const cart = await update(id, [{
      action: 'addLineItem', sku: BUNDLE_SKU, quantity: 1, key: KEY, externalPrice: { currencyCode: 'USD', centAmount: 34916 },
      custom: fields({ bundlePreset: '0' }),
    }]);
    expect(cart.lineItems).toHaveLength(1);
    expect(cart.lineItems[0]).toMatchObject({ key: KEY, priceMode: 'ExternalPrice', price: { value: { centAmount: 34916 } } });
  });

  it('a keyed line never merges, and a part merges only into a part of the same bundle', async () => {
    const id = seedCart();
    const cart = await update(id, [
      { action: 'addLineItem', sku: BUNDLE_SKU, quantity: 1, key: KEY, externalPrice: { currencyCode: 'USD', centAmount: 34916 }, custom: fields({}) },
      { action: 'addLineItem', sku: PART_SKU, quantity: 1, externalPrice: { currencyCode: 'USD', centAmount: 0 }, custom: fields({ parentId: KEY }) },
      { action: 'addLineItem', sku: PART_SKU, quantity: 1, custom: fields({}) },
      { action: 'addLineItem', sku: PART_SKU, quantity: 1, externalPrice: { currencyCode: 'USD', centAmount: 0 }, custom: fields({ parentId: KEY }) },
    ]);
    // parent, one part of the bundle (raised to 2), one standalone line of the same SKU
    expect(cart.lineItems).toHaveLength(3);
    const parts = cart.lineItems.filter((l) => l.custom?.fields?.parentId === KEY);
    expect(parts).toHaveLength(1);
    expect(parts[0].quantity).toBe(2);
    expect(cart.lineItems.find((l) => !l.custom?.fields?.parentId && l.variant.sku === PART_SKU)).toMatchObject({ quantity: 1, price: { value: { centAmount: 17900 } } });
  });

  it('recalculate keeps an external price and reprices a standard line', async () => {
    const id = seedCart();
    await update(id, [
      { action: 'addLineItem', sku: PART_SKU, quantity: 1, externalPrice: { currencyCode: 'USD', centAmount: 0 }, custom: fields({ parentId: KEY }) },
      { action: 'addLineItem', sku: PART_SKU, quantity: 1, custom: fields({}) },
    ]);
    fake.prices[PART_SKU] = 19900; // a catalogue price change
    const cart = await update(id, [{ action: 'recalculate', updateProductData: true }]);
    const byParent = cart.lineItems.find((l) => l.custom?.fields?.parentId === KEY);
    const standard = cart.lineItems.find((l) => !l.custom?.fields?.parentId);
    expect(byParent).toMatchObject({ priceMode: 'ExternalPrice', price: { value: { centAmount: 0 } } });
    expect(standard).toMatchObject({ price: { value: { centAmount: 19900 } } });
  });

  it('setLineItemPrice changes an external price', async () => {
    const id = seedCart();
    const added = await update(id, [{
      action: 'addLineItem', sku: BUNDLE_SKU, quantity: 1, key: KEY, externalPrice: { currencyCode: 'USD', centAmount: 34916 }, custom: fields({}),
    }]);
    const cart = await update(id, [{
      action: 'setLineItemPrice', lineItemId: added.lineItems[0].id, externalPrice: { currencyCode: 'USD', centAmount: 30000 },
    }]);
    expect(cart.lineItems[0]).toMatchObject({ priceMode: 'ExternalPrice', price: { value: { centAmount: 30000 } } });
  });
});
