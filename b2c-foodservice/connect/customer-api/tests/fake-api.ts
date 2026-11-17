import type { Cart, Customer, CustomerUpdateAction, Order, ShoppingList } from '@commercetools/platform-sdk';
import { ConcurrentModificationError } from '../src/errors';
import type { CartState, CtApi, Paging } from '../src/ct-api';

export const OURS = 'instore-customer-type';
export const CID = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';

type Fields = Record<string, unknown>;

export function customer(id: string, custom?: { key: string; fields: Fields }): Customer {
  return {
    id,
    version: 1,
    email: 'demo@example.com',
    custom: custom ? { type: { typeId: 'type', id: `type-${custom.key}`, obj: { key: custom.key } }, fields: custom.fields } : undefined,
  } as unknown as Customer;
}

/** An in-memory CtApi that records every call and can inject ConcurrentModification. */
export class FakeApi implements CtApi {
  customers = new Map<string, Customer>();
  orders: Order[] = [];
  carts: Cart[] = [];
  lists: ShoppingList[] = [];
  /** Every update, in order. */
  updates: { id: string; version: number; actions: CustomerUpdateAction[] }[] = [];
  /** Every list call's arguments. */
  listCalls: { kind: string; customerId: string; paging: Paging; cartState?: CartState }[] = [];
  /** Number of upcoming updates that fail with ConcurrentModification. */
  conflicts = 0;

  add(c: Customer): this {
    this.customers.set(c.id, c);
    return this;
  }

  async getCustomer(id: string) {
    return structuredClone(this.customers.get(id) ?? null);
  }

  async updateCustomer(id: string, version: number, actions: CustomerUpdateAction[]) {
    this.updates.push({ id, version, actions });
    const current = this.customers.get(id)!;
    if (this.conflicts > 0) {
      this.conflicts--;
      // Someone else wrote first: the stored version moves on.
      this.customers.set(id, { ...current, version: current.version + 1 });
      throw new ConcurrentModificationError();
    }
    if (version !== current.version) throw new ConcurrentModificationError();
    let custom = current.custom ? structuredClone(current.custom) : undefined;
    for (const a of actions) {
      if (a.action === 'setCustomType') {
        const key = (a.type as { key: string }).key;
        custom = { type: { typeId: 'type', id: `type-${key}`, obj: { key } } as never, fields: (a.fields ?? {}) as Fields } as never;
      } else if (a.action === 'setCustomField') {
        if (a.value === undefined) delete (custom!.fields as Fields)[a.name];
        else (custom!.fields as Fields)[a.name] = a.value;
      }
    }
    const next = { ...current, version: current.version + 1, custom } as Customer;
    this.customers.set(id, next);
    return structuredClone(next);
  }

  private page<T>(items: T[], { limit, offset }: Paging) {
    return { limit, offset, count: items.slice(offset, offset + limit).length, total: items.length, results: items.slice(offset, offset + limit) };
  }

  async listOrders(customerId: string, paging: Paging) {
    this.listCalls.push({ kind: 'orders', customerId, paging });
    return this.page(this.orders.filter((o) => o.customerId === customerId), paging) as never;
  }
  async getOrder(id: string) {
    return this.orders.find((o) => o.id === id) ?? null;
  }
  async listCarts(customerId: string, paging: Paging, cartState?: CartState) {
    this.listCalls.push({ kind: 'carts', customerId, paging, cartState });
    return this.page(this.carts.filter((c) => c.customerId === customerId && (!cartState || c.cartState === cartState)), paging) as never;
  }
  async getCart(id: string) {
    return this.carts.find((c) => c.id === id) ?? null;
  }
  async listShoppingLists(customerId: string, paging: Paging) {
    this.listCalls.push({ kind: 'wishlists', customerId, paging });
    return this.page(this.lists.filter((l) => l.customer?.id === customerId), paging) as never;
  }
  async getShoppingList(id: string) {
    return this.lists.find((l) => l.id === id) ?? null;
  }
}
