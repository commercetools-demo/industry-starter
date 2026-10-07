import { createHttp, readSpikeEnv, SpikeHttpError } from './http';
import { shapeOf } from '../recurring-checkout';

const base = { CTP_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_API_URL: 'https://api.example.test', CTP_AUTH_URL: 'https://auth.example.test', CTP_CLIENT_ID: 'id', CTP_CLIENT_SECRET: 'secret' };

describe('spike http', () => {
  it('refuses a project other than spec-test-b2c-telecom', () => {
    expect(() => readSpikeEnv({ ...base, CTP_PROJECT_KEY: 'other' })).toThrow(/not spec-test-b2c-telecom/);
    expect(readSpikeEnv(base).projectKey).toBe('spec-test-b2c-telecom');
  });
  it('names a missing variable without printing values', () => {
    expect(() => readSpikeEnv({ ...base, CTP_CLIENT_SECRET: undefined })).toThrow('Missing environment variable: CTP_CLIENT_SECRET');
  });
  it('maps an error response to SpikeHttpError with the first error code', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (url.includes('/oauth/token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
      return new Response(JSON.stringify({ errors: [{ code: 'InvalidOperation', message: 'm'.repeat(300) }] }), { status: 400 });
    }) as unknown as typeof fetch;
    const http = createHttp(readSpikeEnv(base), fetchImpl);
    const err = await http.api('GET', 'carts/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpikeHttpError);
    expect((err as SpikeHttpError).status).toBe(400);
    expect((err as SpikeHttpError).code).toBe('InvalidOperation');
    expect((err as SpikeHttpError).message.length).toBe(200);
    expect(calls[1]).toBe('https://api.example.test/spec-test-b2c-telecom/carts/x');
  });
  it('routes service calls to the session and checkout hosts', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(url.includes('oauth') ? { access_token: 't' } : { id: 's' }), { status: 201 });
    }) as unknown as typeof fetch;
    const http = createHttp(readSpikeEnv({ ...base, CTP_API_URL: 'https://api.us-central1.gcp.commercetools.com' }), fetchImpl);
    const res = await http.service('session', 'POST', 'sessions', {});
    expect(res.status).toBe(201);
    expect(urls[1]).toBe('https://session.us-central1.gcp.commercetools.com/spec-test-b2c-telecom/sessions');
  });
  it('shapeOf lists nested field names without values', () => {
    expect(shapeOf({ action: 'x', recurringPaymentConfiguration: { paymentStrategy: 'Checkout' } })).toBe('{action,recurringPaymentConfiguration{paymentStrategy}}');
  });
});
