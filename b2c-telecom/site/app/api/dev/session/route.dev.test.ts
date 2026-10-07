// @vitest-environment node
import { POST } from './route.dev';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/dev/session', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));

describe('POST /api/dev/session', () => {
  it('anonymous sets an HttpOnly session cookie', async () => {
    const res = await post({ kind: 'anonymous' });
    expect(res.status).toBe(200);
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toContain('malva-session=');
    expect(header).toContain('HttpOnly');
  });

  it('customer sets a cookie as well', async () => {
    const res = await post({ kind: 'customer' });
    expect(res.headers.get('set-cookie')).toContain('malva-session=');
  });

  it('clear expires the cookie', async () => {
    const res = await post({ kind: 'clear' });
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects an unknown kind', async () => {
    const res = await post({ kind: 'admin' });
    expect(res.status).toBe(400);
  });
});
