import { vi } from 'vitest';
import orderFixture from '../mappers/__fixtures__/order.json';

/** Shared fixtures and a fluent fake of `getApiRoot().orders()` for the order-edits tests. */
export const calls = {
  orderGet: vi.fn(),
  listGet: vi.fn(),
  editGet: vi.fn(),
  editPost: vi.fn(),
  apply: vi.fn(),
};
export const results = {
  order: vi.fn(),
  list: vi.fn(),
  edit: vi.fn(),
  editPost: vi.fn(),
  apply: vi.fn(),
};

export const fakeRoot = () => ({
  orders: () => ({
    withId: (id: unknown) => ({ get: () => (calls.orderGet(id), { execute: results.order }) }),
    edits: () => ({
      get: (arg: unknown) => (calls.listGet(arg), { execute: results.list }),
      withId: (id: unknown) => ({
        get: () => (calls.editGet(id), { execute: () => results.edit(id) }),
        post: (arg: unknown) => (calls.editPost(id, arg), { execute: results.editPost }),
        apply: () => ({ post: (arg: unknown) => (calls.apply(id, arg), { execute: results.apply }) }),
      }),
    }),
  }),
});

type Json = Record<string, unknown>;
const money = (centAmount: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount, fractionDigits: 2 });

export const ownerOrder = (over: Json = {}): never => ({ ...(JSON.parse(JSON.stringify(orderFixture)) as Json), ...over }) as never;
/** The first line of the order fixture. */
export const firstLineId = (): string => (orderFixture.lineItems[0] as { id: string }).id;

export const proposalCustom = (fields: Json = {}, typeKey?: string): Json => ({
  type: typeKey ? { typeId: 'type', id: 't-p', obj: { key: typeKey } } : { typeId: 'type', id: 't-p' },
  fields: { originalLineItemId: firstLineId(), substituteSku: 'OAT-MILK-1L', status: 'pending', note: 'Out of stock', ...fields },
});

export const editOf = (over: Json = {}): Json => ({
  id: 'edit-1',
  version: 3,
  resource: { typeId: 'order', id: 'order-1' },
  stagedActions: [],
  result: { type: 'NotProcessed' },
  custom: proposalCustom({}, 'substitution-proposal'),
  ...over,
});

/** An edit as a single GET returns it: with the preview (new total `newTotalCents`). */
export const previewEdit = (newTotalCents: number, over: Json = {}): Json =>
  editOf({
    result: {
      type: 'PreviewSuccess',
      preview: {
        totalPrice: money(newTotalCents),
        lineItems: [{ id: 'new-line', name: { 'en-US': 'Oat milk 1 L', 'de-DE': 'Haferdrink 1 l' }, variant: { sku: 'OAT-MILK-1L' } }],
      },
    },
    ...over,
  });
