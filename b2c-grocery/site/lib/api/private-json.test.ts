// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { privateJson, unauthenticated } from './private-json';

describe('privateJson', () => {
  it('Shared cache: the response is private, no-store', async () => {
    const res = privateJson({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('keeps the status and still sets the header', () => {
    const res = privateJson({ error: 'X' }, { status: 404, headers: { 'x-test': '1' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('x-test')).toBe('1');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('unauthenticated is a private 401', async () => {
    const res = unauthenticated();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'UNAUTHENTICATED' });
  });
});
