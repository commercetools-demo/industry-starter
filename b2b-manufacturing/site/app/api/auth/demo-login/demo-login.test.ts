// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const login = vi.fn();
const save = vi.fn();
vi.mock('@/lib/ct/auth', () => ({ loginCustomer: login }));
vi.mock('@/lib/ct/business-units', () => ({ signInSessionPatch: async (s: object) => ({ ...s, businessUnitKey: 'mpw-demo-co' }) }));
vi.mock('@/lib/auth-limits', () => ({ limitLogin: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ cartId: 'anon' }), saveSession: save }));

const { GET, POST } = await import('./route');
const post = (body: unknown) => POST(new Request('https://malva.example/api/auth/demo-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => { login.mockReset(); save.mockReset(); vi.unstubAllEnvs(); });

describe('malva-client-portal › Sample customer sign-in', () => {
  it('offers nobody, and refuses to sign in, where DEMO_LOGIN_PASSWORD is not set', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', '');
    expect(await (await GET()).json()).toEqual({ users: [] });
    expect((await post({ email: 'demo.admin@example.com' })).status).toBe(404);
    expect(login).not.toHaveBeenCalled();
  });
  it('lists the sample customers without the password when it is set', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 's3cret-demo');
    const res = await GET();
    const text = await res.text();
    expect(JSON.parse(text).users).toHaveLength(4);
    expect(text).not.toContain('s3cret-demo');
  });
  it('signs in a sample customer with the server-side password and saves the session', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 's3cret-demo');
    login.mockResolvedValue({ customer: { id: 'c1' }, cart: { id: 'merged' } });
    const res = await post({ email: 'Demo.Admin@example.com' });
    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalledWith('demo.admin@example.com', 's3cret-demo', 'anon');
    expect(save).toHaveBeenCalled();
  });
  it('refuses an email that is not a sample customer, so it cannot be used to try passwords', async () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 's3cret-demo');
    expect((await post({ email: 'someone@acme.co' })).status).toBe(400);
    expect(login).not.toHaveBeenCalled();
  });
});
