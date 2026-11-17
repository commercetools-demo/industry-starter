// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { planFulfilmentSwitch, type PlanLine } from '@/lib/cart/plan';
import { mapCart } from '@/lib/mappers/cart';
import {
  fulfilmentFieldOf, instoreLineCustom, lineModifierIds, modifierConfigIdOf, modifiersKeyOf, normaliseModifierChoice, parseModifierConfig,
} from '@/lib/mappers/drink-modifiers';
import { ctCart, ctLine, enrichment, vt } from '@/test/cart';

const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';
const ALMOND = 'f8716393-8508-46cb-865a-7dac4731e22a';
const WHOLE = '234908a8-d101-4908-a45c-1f6dfa08efce';
const ref = (id: string) => ({ typeId: 'product', id });

/** The owner's configuration document value (configurable-bundles app, 2026-11-17), trimmed. */
const CONFIG = {
  createProduct: false, selectProduct: true, configurationType: 'custom-object',
  bundleType: { label: 'Ready to-drink coffee', value: 'schema--1794860214584' },
  bundleConfiguration: { possibleModifiers: [ref(WHOLE), ref(OAT), ref(ALMOND), ref(OAT), { typeId: 'product', id: 'not-a-uuid' }] },
};

/** A ready-made coffee line as the cart core writes it (in-store line type: `fulfillment`, optional `modifiers`). */
const drinkLine = (id: string, modifiers: string[] | null, channelId?: string) => ctLine({
  id, sku: 'MCF-RD-AMERICANO-SMALL', productId: 'americano', fulfilment: null, cents: 325,
  ...(channelId ? { channelId } : {}),
  custom: { fulfillment: channelId ? 'collect' : 'delivery', ...(modifiers ? { modifiers: modifiers.map(ref) } : {}) },
});

describe('ready-made coffee modifiers: pure helpers', () => {
  it('reads the offered ids of the configuration in order, without duplicates or bad ids', () => {
    expect(parseModifierConfig(CONFIG)).toEqual([WHOLE, OAT, ALMOND]);
    expect(parseModifierConfig({ bundleConfiguration: { presets: [] } })).toBeNull();
    expect(parseModifierConfig(null)).toBeNull();
  });

  it('reads the configuration id from the drink attribute', () => {
    expect(modifierConfigIdOf([{ name: 'size', value: { key: 'small' } }, { name: 'modifiers', value: { typeId: 'key-value-document', id: OAT } }])).toBe(OAT);
    expect(modifierConfigIdOf([{ name: 'size', value: { key: 'small' } }])).toBeNull();
  });

  it('a choice is checked against the offer, deduplicated and sorted (the same set in another order is the same line)', () => {
    expect(normaliseModifierChoice([OAT, ALMOND], [WHOLE, OAT, ALMOND])).toEqual(normaliseModifierChoice([ALMOND, OAT, OAT], [WHOLE, OAT, ALMOND]));
    expect(normaliseModifierChoice([OAT, ALMOND], [WHOLE, OAT, ALMOND])).toEqual([OAT, ALMOND].sort());
    expect(normaliseModifierChoice([OAT, 'b0b0b0b0-0000-4000-8000-000000000000'], [OAT])).toBeNull();
  });

  it('builds the in-store line custom: `fulfillment` always, `modifiers` only when chosen', () => {
    expect(instoreLineCustom('delivery', [ALMOND, OAT])).toEqual({
      type: { typeId: 'type', key: 'instore-lineitem-type' },
      fields: { fulfillment: 'delivery', modifiers: [ref(ALMOND), ref(OAT)] },
    });
    expect(instoreLineCustom('collect', []).fields).toEqual({ fulfillment: 'collect' });
  });

  it('tells a ready-made coffee line from any other line, and names its fulfilment field', () => {
    expect(lineModifierIds(drinkLine('a', [OAT, ALMOND]))).toEqual([ALMOND, OAT].sort());
    expect(lineModifierIds(drinkLine('b', null))).toEqual([]);
    expect(lineModifierIds(ctLine({ id: 'c', sku: 'MCF-POD-X' }))).toBeUndefined();
    expect(fulfilmentFieldOf(drinkLine('a', null))).toBe('fulfillment');
    expect(fulfilmentFieldOf(ctLine({ id: 'c', sku: 'MCF-POD-X' }))).toBe('fulfilment');
    expect(modifiersKeyOf(drinkLine('a', [OAT, ALMOND]))).toBe(modifiersKeyOf(drinkLine('b', [ALMOND, OAT])));
  });
});

describe('ready-made coffee lines in the bag', () => {
  it('the bag reads the fulfilment from the in-store field and shows size and modifier names', () => {
    const line = drinkLine('L1', [OAT]);
    const cart = ctCart({ lines: [line] });
    const view = mapCart(cart, enrichment({
      products: { americano: { shape: 'readyDrink', variants: { 'MCF-RD-AMERICANO-SMALL': { attrs: { size: 'small' }, labels: { size: 'Small (12 oz)' } } } } },
      modifierNames: { [OAT]: 'Oat milk' },
    }), { locale: 'en-US', t: vt, collection: true });
    expect(view.lines[0]).toMatchObject({ fulfilment: 'delivery', brand: 'malva-coffee', modifiers: ['Oat milk'], variantSummary: 'Small (12 oz) · Oat milk' });
  });

  it('a switch never folds a drink into a twin with other modifiers', () => {
    const lines: PlanLine[] = [
      { id: 'oat', sku: 'MCF-RD-AMERICANO-SMALL', quantity: 1, fulfilment: 'delivery', subscribe: false, modifiers: OAT },
      { id: 'almond', sku: 'MCF-RD-AMERICANO-SMALL', quantity: 1, fulfilment: 'collect', channelId: 'ch-soho', subscribe: false, modifiers: ALMOND },
      { id: 'oat-collect', sku: 'MCF-RD-AMERICANO-SMALL', quantity: 2, fulfilment: 'collect', channelId: 'ch-soho', subscribe: false, modifiers: OAT },
    ];
    const plan = planFulfilmentSwitch(lines, 'oat', { fulfilment: 'collect', channelId: 'ch-soho' });
    expect(plan).toMatchObject({ kind: 'ops', ops: [{ kind: 'merge', keepId: 'oat-collect', removeId: 'oat' }] });
    const alone = planFulfilmentSwitch(lines.slice(0, 2), 'oat', { fulfilment: 'collect', channelId: 'ch-soho' });
    expect(alone).toMatchObject({ kind: 'ops', ops: [{ kind: 'set', lineId: 'oat' }] });
  });
});
