// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { privateJson } from './private-json';

describe('privateJson', () => {
  it('sets Cache-Control private, no-store and keeps status and body', async () => {
    const res = privateJson({ a: 1 }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ a: 1 });
  });
});
