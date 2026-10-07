// @vitest-environment node
import { resetServiceabilityForTests, stubModeFromEnv } from '@/lib/ct/serviceability';
import * as route from './route';

const get = (query = '', cookie?: string) =>
  route.GET(new Request(`http://localhost/api/serviceability${query}`, { headers: cookie ? { cookie } : {} }));
const post = (body: unknown) =>
  route.POST(new Request('http://localhost/api/serviceability', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  resetServiceabilityForTests();
  vi.unstubAllEnvs();
});

describe('GET /api/serviceability', () => {
  it('answers 200 with the location and a checkedAt that stays the same within the cache window', async () => {
    const res = await get('?postalCode=10001&country=US');
    expect(res.status).toBe(200);
    const { location } = await res.json();
    expect(location).toMatchObject({ postalCode: '10001', country: 'US', anyServed: true, served: { cable: true, 'fixed-wireless': true, mobile: true } });
    expect(Number.isNaN(Date.parse(location.checkedAt))).toBe(false);
    expect((await (await get('?postalCode=10001')).json()).location.checkedAt).toBe(location.checkedAt);
  });

  it('answers the seeded cases for both countries and reduces ZIP+4', async () => {
    expect((await (await get('?postalCode=60601')).json()).location.served).toEqual({ cable: true, 'fixed-wireless': false, mobile: true });
    expect((await (await get('?postalCode=80331&country=DE')).json()).location.served).toEqual({ cable: true, 'fixed-wireless': false, mobile: true });
    expect((await (await get('?postalCode=10001-1234')).json()).location.postalCode).toBe('10001');
  });

  it('Location not served at all: GET answers anyServed false', async () => {
    const { location } = await (await get('?postalCode=99999')).json();
    expect(location.anyServed).toBe(false);
    expect((await (await get('?postalCode=99998&country=DE')).json()).location.anyServed).toBe(false);
  });

  it('400 INVALID_POSTAL_CODE for letters, 4 and 6 digits; 400 INVALID_COUNTRY for FR', async () => {
    for (const bad of ['abc', '1234', '123456']) {
      const res = await get(`?postalCode=${bad}`);
      expect(res.status, bad).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_POSTAL_CODE');
    }
    const country = await get('?postalCode=10001&country=FR');
    expect(country.status).toBe(400);
    expect((await country.json()).error.code).toBe('INVALID_COUNTRY');
  });

  it('without a postalCode returns the remembered location, or null', async () => {
    expect(await (await get('?country=US')).json()).toEqual({ location: null });
    const remembered = (await (await get('?country=US', 'a=b; malva-postal-code=60601')).json()).location;
    expect(remembered.postalCode).toBe('60601');
    expect((await (await get('?country=US', 'malva-postal-code=junk')).json()).location).toBeNull();
  });

  it('writes no cookie', async () => {
    expect((await get('?postalCode=10001')).headers.get('set-cookie')).toBeNull();
    expect((await get('?country=US', 'malva-postal-code=60601')).headers.get('set-cookie')).toBeNull();
  });
});

describe('POST /api/serviceability', () => {
  it('sets the cookie HttpOnly, SameSite Lax, 30 days', async () => {
    const res = await post({ postalCode: '60601', country: 'US' });
    expect(res.status).toBe(200);
    expect((await res.json()).location.postalCode).toBe('60601');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('malva-postal-code=60601');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/');
  });

  it('null clears the cookie and answers location null', async () => {
    const res = await post({ postalCode: null });
    expect(await res.json()).toEqual({ location: null });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('malva-postal-code=;');
    expect(cookie).toContain('Max-Age=0');
  });

  it('validates the ZIP, the country and the body without setting a cookie', async () => {
    for (const body of [{ postalCode: 'abc' }, { postalCode: 12345 }, { postalCode: '1234', country: 'US' }, { postalCode: '12345-6789', country: 'DE' }]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_POSTAL_CODE');
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    expect((await (await post({ postalCode: '10001', country: 'FR' })).json()).error.code).toBe('INVALID_COUNTRY');
    expect((await post('not json')).status).toBe(400);
    expect((await post([1])).status).toBe(400);
  });

  it('exports only GET and POST, so every other method is a 405', () => {
    expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
  });
});

describe('stub mode from the environment', () => {
  it('reads table, all and none; anything else is table', () => {
    expect(['all', 'none', 'table', 'x', undefined].map((value) => stubModeFromEnv(value))).toEqual(['all', 'none', 'table', 'table', 'table']);
  });

  it('SERVICEABILITY_STUB=none serves nothing', async () => {
    vi.stubEnv('SERVICEABILITY_STUB', 'none');
    expect((await (await get('?postalCode=10001')).json()).location.anyServed).toBe(false);
  });
});
