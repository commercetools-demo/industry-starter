// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const CONFIG_ID = '023564ad-8b02-4230-a8bd-c9b6f7d7adfc';
const CATEGORY = 'e8d9dfc7-e5bc-441f-8324-9bf9c5c2f153';
const OAT = '572a1c72-24e1-4a96-a693-d022be0cd867';

const ct = vi.hoisted(() => ({ queries: [] as Record<string, unknown>[], results: [] as unknown[], config: null as unknown }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    productProjections: () => ({
      get: ({ queryArgs }: { queryArgs: Record<string, unknown> }) => {
        ct.queries.push(queryArgs);
        return { execute: async () => ({ body: { results: ct.results } }) };
      },
    }),
  },
}));
vi.mock('@/lib/ct/preset-bundles', () => ({ getKeyValueDocumentValue: async () => ct.config }));

import { getDrinkChoiceIds, getFlavorOptions } from '@/lib/ct/drink-modifiers';

const drink = { masterVariant: { attributes: [{ name: 'modifiers', value: { typeId: 'key-value-document', id: CONFIG_ID } }] } } as never;
const pod = (id: string, name: string, description: string | undefined, intensity?: number) => ({
  id, name: { 'en-US': name }, ...(description ? { description: { 'en-US': description } } : {}),
  masterVariant: { attributes: intensity === undefined ? [{ name: 'decaf', value: false }] : [{ name: 'intensity', value: intensity }] },
});

beforeEach(() => {
  ct.queries.length = 0;
  ct.config = { bundleConfiguration: { possibleModifiers: [{ typeId: 'product', id: OAT }], flavor: { typeId: 'category', id: CATEGORY } } };
  ct.results = [
    pod('melozio', 'Melozio', 'Melozio is smooth.', 6),
    pod('chiaro', 'Double Espresso Chiaro', 'Woody.'),
    pod('intenso', 'Intenso', 'Intenso is deep.', 9),
    pod('odacio', 'Odacio', undefined, 7),
  ];
});

describe('ready-made coffee: pod flavors', () => {
  it('reads the published products of the configuration category, the roastiest first, with their descriptions', async () => {
    const flavors = await getFlavorOptions(drink, 'en-US');
    expect(ct.queries[0]).toMatchObject({ staged: false, where: `categories(id="${CATEGORY}")` });
    expect(flavors.map((f) => f.name)).toEqual(['Intenso', 'Odacio', 'Melozio', 'Double Espresso Chiaro']);
    expect(flavors[0]).toEqual({ id: 'intenso', name: 'Intenso', description: 'Intenso is deep.', intensity: 9 });
    expect(flavors[1]?.description).toBe('');
  });

  it('a configuration without a flavor category offers none and reads no product', async () => {
    ct.config = { bundleConfiguration: { possibleModifiers: [] } };
    expect(await getFlavorOptions(drink, 'en-US')).toEqual([]);
    expect(ct.queries).toHaveLength(0);
  });

  it('the cart accepts the modifiers and the flavors, and tells the flavors apart', async () => {
    const { allowed, flavorIds } = await getDrinkChoiceIds(drink);
    expect(allowed).toEqual([OAT, 'intenso', 'odacio', 'melozio', 'chiaro']);
    expect(flavorIds).toEqual(['intenso', 'odacio', 'melozio', 'chiaro']);
  });
});
