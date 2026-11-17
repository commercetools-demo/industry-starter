import type { Cart, Order, ShoppingList } from '@commercetools/platform-sdk';
import request from 'supertest';
import { createApp } from '../src/app';
import { CID, customer, FakeApi, OTHER } from './fake-api';

const quiet = () => undefined;
const make = () => {
  const api = new FakeApi().add(customer(CID)).add(customer(OTHER));
  return { api, app: createApp(api, { log: quiet }) };
};
const order = (id: string, customerId: string) => ({ id, customerId }) as unknown as Order;
const cart = (id: string, customerId: string, cartState = 'Active') => ({ id, customerId, cartState }) as unknown as Cart;
const list = (id: string, customerId: string) => ({ id, customer: { typeId: 'customer', id: customerId } }) as unknown as ShoppingList;

describe('orders', () => {
  it('lists only the customer’s orders, passing the id to the query layer', async () => {
    const { api, app } = make();
    api.orders = [order('o1', CID), order('o2', OTHER)];
    const res = await request(app).get(`/customers/${CID}/orders`);
    expect(res.status).toBe(200);
    expect(res.body.results.map((o: Order) => o.id)).toEqual(['o1']);
    expect(api.listCalls[0]).toMatchObject({ kind: 'orders', customerId: CID, paging: { limit: 20, offset: 0 } });
  });

  it('limit is capped at 100 and bad paging answers 400', async () => {
    const { api, app } = make();
    await request(app).get(`/customers/${CID}/orders?limit=5000&offset=3`);
    expect(api.listCalls[0].paging).toEqual({ limit: 100, offset: 3 });
    expect((await request(app).get(`/customers/${CID}/orders?limit=abc`)).status).toBe(400);
  });

  it('returns the order by id', async () => {
    const { api, app } = make();
    api.orders = [order('o1', CID)];
    const res = await request(app).get(`/customers/${CID}/orders/o1`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('o1');
  });

  it('order of another customer answers 404', async () => {
    const { api, app } = make();
    api.orders = [order('o2', OTHER)];
    expect((await request(app).get(`/customers/${CID}/orders/o2`)).status).toBe(404);
    expect((await request(app).get(`/customers/${CID}/orders/missing`)).status).toBe(404);
  });

  it('other methods answer 405 with Allow', async () => {
    const res = await request(make().app).delete(`/customers/${CID}/orders`);
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET');
  });
});

describe('carts', () => {
  it('cartState filter', async () => {
    const { api, app } = make();
    api.carts = [cart('c1', CID, 'Active'), cart('c2', CID, 'Ordered')];
    const res = await request(app).get(`/customers/${CID}/carts?cartState=Ordered`);
    expect(res.body.results.map((c: Cart) => c.id)).toEqual(['c2']);
    expect(api.listCalls[0].cartState).toBe('Ordered');
  });

  it('invalid cartState answers 400', async () => {
    const res = await request(make().app).get(`/customers/${CID}/carts?cartState=Bogus`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_cartState');
  });

  it('cart of another customer answers 404', async () => {
    const { api, app } = make();
    api.carts = [cart('c9', OTHER)];
    expect((await request(app).get(`/customers/${CID}/carts/c9`)).status).toBe(404);
  });

  it('returns the cart by id', async () => {
    const { api, app } = make();
    api.carts = [cart('c1', CID)];
    expect((await request(app).get(`/customers/${CID}/carts/c1`)).body.id).toBe('c1');
  });
});

describe('wishlists', () => {
  it('list paging', async () => {
    const { api, app } = make();
    api.lists = [list('l1', CID), list('l2', CID), list('l3', OTHER)];
    const res = await request(app).get(`/customers/${CID}/wishlists?limit=1&offset=1`);
    expect(res.body).toMatchObject({ limit: 1, offset: 1, total: 2 });
    expect(res.body.results.map((l: ShoppingList) => l.id)).toEqual(['l2']);
  });

  it('wishlist of another customer answers 404', async () => {
    const { api, app } = make();
    api.lists = [list('l3', OTHER)];
    expect((await request(app).get(`/customers/${CID}/wishlists/l3`)).status).toBe(404);
  });

  it('returns the wishlist by id', async () => {
    const { api, app } = make();
    api.lists = [list('l1', CID)];
    expect((await request(app).get(`/customers/${CID}/wishlists/l1`)).body.id).toBe('l1');
  });
});
