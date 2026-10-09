// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession, sessionMock } from '../../../test/api-helpers';

const save = vi.fn();
const login = vi.fn();
const register = vi.fn();
const patch = vi.fn();
const store = vi.fn();
vi.mock('@/lib/session', async () => ({ ...(await import('@/lib/session-core')), getSession: async () => sessionMock.current, saveSession: save }));
vi.mock('@/lib/ct/auth', () => ({ loginCustomer: login }));
vi.mock('@/lib/ct/registration', () => ({ registerCompany: register }));
vi.mock('@/lib/ct/business-units', () => ({ signInSessionPatch: patch }));
vi.mock('@/lib/ct/stores', () => ({ getStoreChannelData: store }));
const limits = vi.hoisted(() => ({ reg: { allow: () => true } as { allow: (k: string) => boolean }, log: { allow: () => true } as { allow: (k: string) => boolean } }));
vi.mock('@/lib/auth-limits', async () => {
  const { ApiError } = await import('@/lib/errors');
  const over = () => new ApiError(429, 'Too many attempts. Please try again later.', { retryAfter: 42 });
  return { limitRegistration: async () => { if (!limits.reg.allow('ip')) throw over(); }, limitLogin: async () => { if (!limits.log.allow('ip')) throw over(); } };
});

const { POST: registerPost } = await import('./register/route');
const { POST: loginPost } = await import('./login/route');
const { POST: logoutPost } = await import('./logout/route');
const { GET: me } = await import('./me/route');
const req = (body: unknown) => new Request('http://x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { companyName: 'Acme', sector: 'manufacturing', firstName: 'A', lastName: 'B', jobTitle: 'H', email: 'a@acme.co', phone: '1', password: 'correct-horse-9', website: '', startedAt: Date.now() - 60_000 };

beforeEach(() => { vi.clearAllMocks(); limits.reg = { allow: () => true }; limits.log = { allow: () => true }; mockSession({ cartId: 'anon' }); store.mockResolvedValue({ storeKey: 'mpw-web', storeId: 's1' }); });

describe('malva-client-portal › Open registration (route)', () => {
  it('Register: signs the new administrator in with the company context and merged cart', async () => {
    register.mockResolvedValue({ status: 'created', customer: { id: 'c1' }, businessUnitKey: 'mpw-acme-1' });
    login.mockResolvedValue({ customer: { id: 'c1', email: 'a@acme.co', firstName: 'A', lastName: 'B' }, cart: { id: 'merged' } });
    const res = await registerPost(req(good));
    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalledWith('a@acme.co', 'correct-horse-9', 'anon');
    expect(save.mock.calls[0]![0]).toMatchObject({ customerId: 'c1', businessUnitKey: 'mpw-acme-1', storeKey: 'mpw-web', cartId: 'merged' });
    expect(JSON.stringify(save.mock.calls[0]![0])).not.toContain('correct-horse');
  });
  it('Password rules: a weak password is refused with the rule and nothing is created', async () => {
    const res = await registerPost(req({ ...good, password: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.password).toMatch(/at least 10/);
    expect(register).not.toHaveBeenCalled();
  });
  it('field errors name the field', async () => {
    const res = await registerPost(req({ ...good, email: 'nope' }));
    expect((await res.json()).fieldErrors.email).toBeTruthy();
    expect((await registerPost(req('not json'))).status).toBe(400);
  });
  it('Email already registered: generic message, no session written', async () => {
    register.mockResolvedValue({ status: 'duplicate' });
    const res = await registerPost(req(good));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/may already exist/);
    expect(save).not.toHaveBeenCalled();
  });
  it('Abuse: a filled honeypot or an instant submit creates nothing and looks like a duplicate', async () => {
    for (const bad of [{ ...good, website: 'http://spam.example' }, { ...good, startedAt: Date.now() }, { ...good, startedAt: 0 }]) {
      const res = await registerPost(req(bad));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/may already exist/);
    }
    expect(register).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it('Abuse: over the limit is rejected with a generic message and creates nothing', async () => {
    let n = 0;
    limits.reg = { allow: () => { n += 1; return n <= 1; } };
    await registerPost(req({ ...good, password: 'x' }));
    const res = await registerPost(req(good));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect((await res.json()).error).toBe('Too many attempts. Please try again later.');
    expect(register).not.toHaveBeenCalled();
  });
});

describe('malva-client-portal › Client sign-in (route)', () => {
  it('signs in: session patch from F, merged cart, only the business unit key returned', async () => {
    login.mockResolvedValue({ customer: { id: 'c1' }, cart: { id: 'k2' } });
    patch.mockResolvedValue({ customerId: 'c1', businessUnitKey: 'co' });
    const res = await loginPost(req({ email: 'A@B.co', password: 'pw' }));
    expect(await res.json()).toEqual({ businessUnitKey: 'co' });
    expect(login).toHaveBeenCalledWith('a@b.co', 'pw', 'anon');
    expect(save.mock.calls[0]![0]).toMatchObject({ customerId: 'c1', cartId: 'k2' });
  });
  it('Wrong credentials: one message, 401, nothing saved', async () => {
    login.mockResolvedValue(null);
    const res = await loginPost(req({ email: 'a@b.co', password: 'bad' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Email or password is incorrect.' });
    expect(save).not.toHaveBeenCalled();
  });
  it('400 for missing fields; 429 over the limit', async () => {
    expect((await loginPost(req({}))).status).toBe(400);
    limits.log = { allow: () => false };
    expect((await loginPost(req({ email: 'a@b.co', password: 'x' }))).status).toBe(429);
  });
  it('a failing lookup after a good password leaves the cookie unchanged', async () => {
    login.mockResolvedValue({ customer: { id: 'c1' } });
    patch.mockRejectedValue(new Error('down'));
    expect((await loginPost(req({ email: 'a@b.co', password: 'pw' }))).status).toBe(500);
    expect(save).not.toHaveBeenCalled();
  });
  it('Sign-out clears customer, cart and unit; me returns null when anonymous', async () => {
    mockSession({ customerId: 'c1', customerEmail: 'e@x.co', cartId: 'k', businessUnitKey: 'co', storeKey: 'mpw-web' });
    expect(await (await me()).json()).toMatchObject({ customerId: 'c1', businessUnitKey: 'co' });
    await logoutPost();
    expect(save.mock.calls[0]![0]).toEqual({ locale: 'en-US', currency: 'USD', country: 'US', storeKey: 'mpw-web' });
    mockSession({});
    expect(await (await me()).json()).toBeNull();
  });
});

describe('malva-client-portal › No password reset', () => {
  it('no reset route, page, link or message exists', () => {
    const root = process.cwd();
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (['node_modules', '.next'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'messages')), ...walk(path.join(root, 'components'))].filter((f) => !/\.test\./.test(f));
    expect(files.filter((f) => /reset|forgot/i.test(f))).toEqual([]);
    expect(files.filter((f) => /forgot (your )?password|reset (your )?password|\/api\/auth\/reset/i.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
