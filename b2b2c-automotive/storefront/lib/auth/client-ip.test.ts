// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Q-X09 (workstream X): the key of the rate limiters never takes the first (client-supplied) value of x-forwarded-for.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp } from './client-ip';

const req = (headers: Record<string, string>) => new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers });
afterEach(() => vi.unstubAllEnvs());

describe('clientIp', () => {
  it('default: the value the trusted proxy appended (rightmost), so a client that prepends a fake address changes nothing', () => {
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });
  it('rotating the spoofed first value does not rotate the key', () => {
    const keys = new Set(['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((fake) => clientIp(req({ 'x-forwarded-for': `${fake}, 203.0.113.7` }))));
    expect(keys.size).toBe(1);
  });
  it('TRUSTED_PROXY_HOPS counts proxies from the right (two proxies: the second to last is the client)', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7'); // chain shorter than configured: the first entry
  });
  it('CLIENT_IP_HEADER names a single-value platform header and then x-forwarded-for is ignored', () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'x-nf-client-connection-ip');
    expect(clientIp(req({ 'x-nf-client-connection-ip': '198.51.100.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('198.51.100.4');
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9' }))).toBe('unknown');
  });
  it('a value that is not an address (junk, script, too long) is unknown, never a key of the attacker choice', () => {
    expect(clientIp(req({ 'x-forwarded-for': '<script>' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': 'a'.repeat(200) }))).toBe('unknown');
    expect(clientIp(req({}))).toBe('unknown');
  });
  it('accepts IPv6', () => {
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });
  it('a bad TRUSTED_PROXY_HOPS falls back to 1', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', 'abc');
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
  });
});
