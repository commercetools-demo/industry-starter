import { ClientBuilder } from '@commercetools/ts-client';
import {
  createApiBuilderFromCtpClient,
  type Cart,
  type CartPagedQueryResponse,
  type Customer,
  type CustomerUpdateAction,
  type Order,
  type OrderPagedQueryResponse,
  type ShoppingList,
  type ShoppingListPagedQueryResponse,
} from '@commercetools/platform-sdk';
import type { Config } from './config';
import { ConcurrentModificationError } from './errors';

export interface Paging {
  limit: number;
  offset: number;
}

export type CartState = 'Active' | 'Merged' | 'Ordered' | 'Frozen';

/** Everything the routes need from commercetools. Tests replace it with an in-memory fake. */
export interface CtApi {
  /** The customer with `custom.type` expanded, or null when it does not exist. */
  getCustomer(id: string): Promise<Customer | null>;
  /** Throws ConcurrentModificationError when `version` is stale. */
  updateCustomer(id: string, version: number, actions: CustomerUpdateAction[]): Promise<Customer>;
  listOrders(customerId: string, paging: Paging): Promise<OrderPagedQueryResponse>;
  getOrder(id: string): Promise<Order | null>;
  listCarts(customerId: string, paging: Paging, cartState?: CartState): Promise<CartPagedQueryResponse>;
  getCart(id: string): Promise<Cart | null>;
  listShoppingLists(customerId: string, paging: Paging): Promise<ShoppingListPagedQueryResponse>;
  getShoppingList(id: string): Promise<ShoppingList | null>;
}

type SdkError = { statusCode?: number; body?: { errors?: { code?: string }[] } };

async function orNull<T>(call: Promise<{ body: T }>): Promise<T | null> {
  try {
    return (await call).body;
  } catch (e) {
    if ((e as SdkError).statusCode === 404) return null;
    throw e;
  }
}

/** The real implementation. Predicates use input variables (`:cid`), never string building. */
export function createCtApi(config: Config): CtApi {
  const client = new ClientBuilder()
    .withProjectKey(config.projectKey)
    .withClientCredentialsFlow({
      host: config.authUrl,
      projectKey: config.projectKey,
      credentials: { clientId: config.clientId, clientSecret: config.clientSecret },
      scopes: config.scopes,
      httpClient: fetch,
    })
    .withHttpMiddleware({ host: config.apiUrl, httpClient: fetch })
    .build();
  const root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: config.projectKey });

  return {
    getCustomer: (id) => orNull(root.customers().withId({ ID: id }).get({ queryArgs: { expand: ['custom.type'] } }).execute()),

    async updateCustomer(id, version, actions) {
      try {
        const res = await root
          .customers()
          .withId({ ID: id })
          .post({ queryArgs: { expand: ['custom.type'] }, body: { version, actions } })
          .execute();
        return res.body;
      } catch (e) {
        const err = e as SdkError;
        if (err.statusCode === 409 && err.body?.errors?.some((x) => x.code === 'ConcurrentModification')) {
          throw new ConcurrentModificationError();
        }
        throw e;
      }
    },

    async listOrders(customerId, { limit, offset }) {
      const res = await root
        .orders()
        .get({ queryArgs: { where: 'customerId = :cid', 'var.cid': customerId, sort: 'createdAt desc', limit, offset } })
        .execute();
      return res.body;
    },
    getOrder: (id) => orNull(root.orders().withId({ ID: id }).get().execute()),

    async listCarts(customerId, { limit, offset }, cartState) {
      const where = ['customerId = :cid'];
      const vars: Record<string, string> = { 'var.cid': customerId };
      if (cartState) {
        where.push('cartState = :state');
        vars['var.state'] = cartState;
      }
      const res = await root
        .carts()
        .get({ queryArgs: { where, ...vars, sort: 'createdAt desc', limit, offset } })
        .execute();
      return res.body;
    },
    getCart: (id) => orNull(root.carts().withId({ ID: id }).get().execute()),

    async listShoppingLists(customerId, { limit, offset }) {
      const res = await root
        .shoppingLists()
        .get({ queryArgs: { where: 'customer(id = :cid)', 'var.cid': customerId, sort: 'createdAt desc', limit, offset } })
        .execute();
      return res.body;
    },
    getShoppingList: (id) => orNull(root.shoppingLists().withId({ ID: id }).get().execute()),
  };
}
