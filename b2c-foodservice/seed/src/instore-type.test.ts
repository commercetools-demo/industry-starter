// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Res } from './api';
import { K } from './data/base';
import { ORDER_TYPE_VALUES, typeDrafts } from './data/custom-types';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';
import { planTypeUpdate } from './sync';

const quiet = () => undefined;
const opts = (api: FakeApi) => ({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
const draft = typeDrafts.find((t) => t.key === 'instore-order-type');
type Def = { name: string; type: { name: string; values: { key: string; label: string }[] } };

describe('In-store order type (workstream R)', () => {
  it('has the owner key, applies to order and cart, and has one enum field orderType', () => {
    expect(draft).toBeDefined();
    expect(K.typeInstoreOrder).toBe('instore-order-type');
    expect([...(draft?.resourceTypeIds ?? [])].sort()).toEqual(['cart', 'order']);
    const defs = (draft?.fieldDefinitions ?? []) as unknown as Def[];
    expect(defs.map((d) => d.name)).toEqual(['orderType']);
    expect(defs[0]?.type.name).toBe('Enum');
  });

  it('offers in-store-purchase and online, both labelled', () => {
    const values = (draft?.fieldDefinitions?.[0] as unknown as Def).type.values;
    expect(values.map((v) => v.key)).toEqual(['in-store-purchase', 'online']);
    expect(values.every((v) => v.label.length > 0)).toBe(true);
    expect(ORDER_TYPE_VALUES).toHaveLength(2);
  });

  it('is created by the types step and a second run changes nothing', async () => {
    const api = new FakeApi();
    await runSeed(opts(api), 'types');
    const type = (await api.getByKey('types', 'instore-order-type')) as Res;
    expect(type.resourceTypeIds).toEqual(['order', 'cart']);
    const again = await runSeed(opts(api), 'types');
    expect(again.changes).toBe(0);
  });

  it('adds a missing enum value to an existing type and never removes one', () => {
    const existing = {
      fieldDefinitions: [{ name: 'orderType', type: { name: 'Enum', values: [{ key: 'online', label: 'Online' }, { key: 'legacy', label: 'Legacy' }] } }],
    } as unknown as Res;
    const actions = planTypeUpdate(existing, draft as never);
    expect(actions).toEqual([{ action: 'addEnumValue', fieldName: 'orderType', value: { key: 'in-store-purchase', label: 'In-store purchase' } }]);
  });

  it('adds the whole field to a type that exists without it', () => {
    const actions = planTypeUpdate({ fieldDefinitions: [] } as unknown as Res, draft as never);
    expect(actions.map((a) => a.action)).toEqual(['addFieldDefinition']);
  });
});
