// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  typeStatus: 'present' as 'present' | 'missing' | 'down',
  typeReads: 0,
  order: { id: 'ord-1', version: 3, custom: undefined as unknown },
  posts: [] as { version: number; actions: unknown[] }[],
  conflictOnce: false,
}));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    types: () => ({
      withKey: () => ({
        get: () => ({
          execute: async () => {
            h.typeReads += 1;
            if (h.typeStatus === 'missing') throw Object.assign(new Error('nf'), { statusCode: 404 });
            if (h.typeStatus === 'down') throw Object.assign(new Error('boom'), { statusCode: 503 });
            return { body: { id: 'type-1', key: 'instore-order-type' } };
          },
        }),
      }),
    }),
    orders: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: { ...h.order } }) }),
        post: ({ body }: { body: { version: number; actions: unknown[] } }) => ({
          execute: async () => {
            if (h.conflictOnce) {
              h.conflictOnce = false;
              throw Object.assign(new Error('conflict'), { statusCode: 409 });
            }
            h.posts.push(body);
            return { body: { ...h.order, version: body.version + 1 } };
          },
        }),
      }),
    }),
  },
}));

import {
  ensureOrderType, orderTypeActive, orderTypeCartActions, orderTypeCustom, planOrderTypeActions, resetOrderTypeCache, withOrderType,
} from './order-type';

const MINE = { type: { typeId: 'type', key: 'instore-order-type' }, fields: { orderType: 'in-store-purchase' } };
const ours = (value?: string) => ({ type: { typeId: 'type', id: 'type-1' }, fields: value ? { orderType: value } : {} }) as never;
const foreign = { type: { typeId: 'type', id: 'type-other' }, fields: {} } as never;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.typeStatus = 'present';
  h.typeReads = 0;
  h.order = { id: 'ord-1', version: 3, custom: undefined };
  h.posts = [];
  h.conflictOnce = false;
  resetOrderTypeCache();
  vi.stubEnv('APP_MODE', 'instore');
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  warn.mockRestore();
});

describe('planOrderTypeActions (pure)', () => {
  it('a cart without a custom type gets the type and the field in one action', () => {
    expect(planOrderTypeActions(undefined, 'type-1')).toEqual([{ action: 'setCustomType', type: MINE.type, fields: MINE.fields }]);
  });
  it('our type with no value or another value gets setCustomField', () => {
    const expected = [{ action: 'setCustomField', name: 'orderType', value: 'in-store-purchase' }];
    expect(planOrderTypeActions(ours(), 'type-1')).toEqual(expected);
    expect(planOrderTypeActions(ours('online'), 'type-1')).toEqual(expected);
  });
  it('a cart that already has the value gets nothing', () => {
    expect(planOrderTypeActions(ours('in-store-purchase'), 'type-1')).toEqual([]);
  });
  it('a foreign custom type is never overwritten', () => {
    expect(planOrderTypeActions(foreign, 'type-1')).toEqual([]);
  });
});

describe('A new cart (draft custom)', () => {
  it('instore mode with the type present: custom is set', async () => {
    expect(await orderTypeCustom()).toEqual(MINE);
    expect(await withOrderType({ currency: 'USD' })).toEqual({ currency: 'USD', custom: MINE });
  });
  it('website mode never sets it and never reads the type', async () => {
    vi.stubEnv('APP_MODE', 'website');
    expect(await orderTypeCustom()).toBeUndefined();
    expect(await withOrderType({ currency: 'USD' })).toEqual({ currency: 'USD' });
    expect(h.typeReads).toBe(0);
  });
  it('Type missing: logs once and skips the field', async () => {
    h.typeStatus = 'missing';
    expect(await orderTypeCustom()).toBeUndefined();
    expect(await orderTypeCustom()).toBeUndefined();
    expect(await withOrderType({ a: 1 })).toEqual({ a: 1 });
    const missing = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('instore_order_type_missing'));
    expect(missing).toHaveLength(1);
    expect(h.typeReads).toBe(1); // cached for a minute
  });
  it('a missing type is asked again after a minute, and a created type is picked up without a redeploy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    h.typeStatus = 'missing';
    expect(await orderTypeActive()).toBe(false);
    h.typeStatus = 'present';
    vi.setSystemTime(new Date('2026-10-23T10:00:30Z'));
    expect(await orderTypeActive()).toBe(false);
    vi.setSystemTime(new Date('2026-10-23T10:01:05Z'));
    expect(await orderTypeActive()).toBe(true);
  });
  it('a failing read is not "missing": it skips the field and tries again soon', async () => {
    h.typeStatus = 'down';
    expect(await orderTypeCustom()).toBeUndefined();
    expect(warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('instore_order_type_missing'))).toBe(false);
    expect(warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('instore_order_type_check_failed'))).toBe(true);
  });
});

describe('An existing cart', () => {
  it('without the field gets setCustomType', async () => {
    expect(await orderTypeCartActions({ custom: undefined })).toEqual([{ action: 'setCustomType', type: MINE.type, fields: MINE.fields }]);
  });
  it('with the right value gets nothing; with another custom type nothing and a log', async () => {
    expect(await orderTypeCartActions({ custom: ours('in-store-purchase') })).toEqual([]);
    expect(await orderTypeCartActions({ custom: foreign })).toEqual([]);
    expect(warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('foreign_custom_type'))).toBe(true);
  });
  it('website mode and a missing type give nothing', async () => {
    vi.stubEnv('APP_MODE', 'website');
    expect(await orderTypeCartActions({ custom: undefined })).toEqual([]);
    vi.stubEnv('APP_MODE', 'instore');
    h.typeStatus = 'missing';
    resetOrderTypeCache();
    expect(await orderTypeCartActions({ custom: undefined })).toEqual([]);
  });
});

describe('The order (post-order hook)', () => {
  it('an in-store order without the field gets it set once', async () => {
    await ensureOrderType({ id: 'ord-1' });
    expect(h.posts).toEqual([{ version: 3, actions: [{ action: 'setCustomType', type: MINE.type, fields: MINE.fields }] }]);
  });
  it('an order that already carries the value is not read or written', async () => {
    await ensureOrderType({ id: 'ord-1', orderType: 'in-store-purchase' });
    expect(h.posts).toEqual([]);
    expect(h.typeReads).toBe(0);
  });
  it('the platform copied the cart custom fields: nothing is written', async () => {
    h.order = { id: 'ord-1', version: 3, custom: ours('in-store-purchase') };
    await ensureOrderType({ id: 'ord-1' });
    expect(h.posts).toEqual([]);
  });
  it('a version conflict is retried once', async () => {
    h.conflictOnce = true;
    await ensureOrderType({ id: 'ord-1' });
    expect(h.posts).toHaveLength(1);
  });
  it('website orders and a missing type are left alone', async () => {
    vi.stubEnv('APP_MODE', 'website');
    await ensureOrderType({ id: 'ord-1' });
    vi.stubEnv('APP_MODE', 'instore');
    h.typeStatus = 'missing';
    resetOrderTypeCache();
    await ensureOrderType({ id: 'ord-1' });
    expect(h.posts).toEqual([]);
  });
});
