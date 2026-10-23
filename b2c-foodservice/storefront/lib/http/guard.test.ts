import { describe, expect, it } from 'vitest';
import { guardRequest } from './guard';

const url = 'http://localhost:3000/api/cart';
const post = (headers: Record<string, string>) => new Request(url, { method: 'POST', headers, body: '{}' });

describe('guardRequest', () => {
  it('foreign origin is refused', () => {
    expect(guardRequest(post({ origin: 'https://evil.example', 'content-type': 'application/json' }))).toEqual({
      code: 'forbidden_origin', status: 403,
    });
  });
  it('the string null origin is refused', () => {
    expect(guardRequest(post({ origin: 'null', 'content-type': 'application/json' }))?.status).toBe(403);
  });
  it('same origin is allowed', () => {
    expect(guardRequest(post({ origin: 'http://localhost:3000', 'content-type': 'application/json' }))).toBeNull();
  });
  it('forwarded host is the own host behind a proxy', () => {
    const req = new Request('http://internal:8080/api/cart', {
      method: 'POST',
      headers: { origin: 'https://shop.example', 'x-forwarded-host': 'shop.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(guardRequest(req)).toBeNull();
  });
  it('non json body is 415', () => {
    expect(guardRequest(post({ 'content-type': 'multipart/form-data; boundary=x' }))).toEqual({ code: 'unsupported_media_type', status: 415 });
    expect(guardRequest(post({ 'content-type': 'application/x-www-form-urlencoded' }))?.status).toBe(415);
  });
  it('no origin header is allowed', () => {
    expect(guardRequest(post({ 'content-type': 'application/json; charset=utf-8' }))).toBeNull();
  });
  it('reads are never guarded', () => {
    expect(guardRequest(new Request(url, { headers: { origin: 'https://evil.example' } }))).toBeNull();
  });
});
