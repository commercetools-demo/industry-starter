import request from 'supertest';
import { createApp } from '../src/app';
import { readConfiguration } from '../src/config';
import { CID, customer, FakeApi } from './fake-api';

const quiet = () => undefined;
const make = (api = new FakeApi()) => ({ api, app: createApp(api, { log: quiet }) });

describe('app shell', () => {
  it('health answers 200 under the connect.yaml endpoint', async () => {
    const res = await request(make().app).get('/customers/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it.each(['PUT', 'DELETE'])('preflight OPTIONS for %s answers 204 with Access-Control-Allow-Origin *', async (method) => {
    const res = await request(make().app)
      .options(`/customers/${CID}/notes/0`)
      .set('Origin', 'https://anywhere.example')
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain(method);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('a real response carries the CORS header and a correlation id', async () => {
    const res = await request(make().app).get('/customers/health').set('Origin', 'https://anywhere.example').set('X-Correlation-ID', 'abc');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['x-correlation-id']).toBe('abc');
  });

  it('CORS_ALLOWED_ORIGIN narrows the origin', async () => {
    const app = createApp(new FakeApi(), { corsOrigin: 'https://shop.example', log: quiet });
    const res = await request(app).get('/customers/health').set('Origin', 'https://shop.example');
    expect(res.headers['access-control-allow-origin']).toBe('https://shop.example');
  });

  it('an unknown path answers 404 JSON', async () => {
    const res = await request(make().app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('errors hide internals outside development', async () => {
    const api = new FakeApi().add(customer(CID));
    api.listOrders = async () => {
      throw new Error('secret stack detail');
    };
    const res = await request(make(api).app).get(`/customers/${CID}/orders`);
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('invalid JSON answers 400', async () => {
    const api = new FakeApi().add(customer(CID));
    const res = await request(make(api).app).post(`/customers/${CID}/notes`).set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
  });
});

describe('configuration', () => {
  const base = {
    CTP_PROJECT_KEY: 'p',
    CTP_CLIENT_ID: 'i',
    CTP_CLIENT_SECRET: 's',
    CTP_SCOPE: 'view_orders:p manage_customers:p',
    CTP_AUTH_URL: 'https://auth',
    CTP_API_URL: 'https://api',
  };

  it('missing variables throw and name every key', () => {
    expect(() => readConfiguration({ CTP_PROJECT_KEY: 'p' })).toThrow(/CTP_CLIENT_ID.*CTP_CLIENT_SECRET/);
  });

  it('CORS_ALLOWED_ORIGIN defaults to *, scopes split on spaces', () => {
    const cfg = readConfiguration(base);
    expect(cfg.corsOrigin).toBe('*');
    expect(cfg.scopes).toEqual(['view_orders:p', 'manage_customers:p']);
  });
});

describe('customer guard', () => {
  it.each(['orders', 'carts', 'wishlists', 'notes', 'loyaltyPoints'])('non-UUID customerId answers 400 on %s', async (path) => {
    const { api, app } = make();
    const res = await request(app).get(`/customers/not-a-uuid/${path}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_customer_id');
    expect(api.listCalls).toHaveLength(0);
  });

  it('unknown customer answers 404 before any list query', async () => {
    const { api, app } = make();
    const res = await request(app).get(`/customers/${CID}/orders`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('customer_not_found');
    expect(api.listCalls).toHaveLength(0);
  });
});
