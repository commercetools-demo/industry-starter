/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { HANDOFF_TTL_SECONDS, IMPERSONATION_AUDIENCE, SecretMissingError, signHandoff, verifyHandoff } from './token';

const secret = 's'.repeat(40);
const input = { customerId: 'cust-1', storeKey: 'store-a', actorId: 'actor-1' };
const T0 = new Date('2026-10-12T10:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('handoff token', () => {
  it('carries sub, store, actor, jti and the storefront audience', async () => {
    const { token, jti } = await signHandoff(input, { secret, now: T0 });
    expect(await verifyHandoff(token, { secret, now: at(1) })).toEqual({ customerId: 'cust-1', storeKey: 'store-a', actorId: 'actor-1', jti });
    expect(jti).toMatch(/^[0-9a-f-]{36}$/);
    const second = await signHandoff(input, { secret, now: T0 });
    expect(second.jti).not.toBe(jti);
  });

  it('lives 60 seconds: valid at 59 s, expired at 61 s', async () => {
    expect(HANDOFF_TTL_SECONDS).toBe(60);
    const { token } = await signHandoff(input, { secret, now: T0 });
    await expect(verifyHandoff(token, { secret, now: at(59) })).resolves.toBeTruthy();
    await expect(verifyHandoff(token, { secret, now: at(61) })).rejects.toThrow();
  });

  it('rejects a wrong audience, a tampered signature and another secret', async () => {
    const key = new TextEncoder().encode(secret);
    const wrongAud = await new SignJWT({ store: 's', actor: 'a' }).setProtectedHeader({ alg: 'HS256' }).setSubject('c').setAudience('somewhere-else').setJti('j').setIssuedAt(Math.floor(T0.getTime() / 1000)).setExpirationTime(Math.floor(T0.getTime() / 1000) + 60).sign(key);
    await expect(verifyHandoff(wrongAud, { secret, now: at(1) })).rejects.toThrow();
    const { token } = await signHandoff(input, { secret, now: T0 });
    const tampered = `${token.slice(0, -3)}${token.endsWith('AAA') ? 'BBB' : 'AAA'}`;
    await expect(verifyHandoff(tampered, { secret, now: at(1) })).rejects.toThrow();
    await expect(verifyHandoff(token, { secret: 'x'.repeat(40), now: at(1) })).rejects.toThrow();
    expect(IMPERSONATION_AUDIENCE).toBe('storefront-impersonation');
  });

  it('refuses to sign without a secret of at least 32 characters', async () => {
    await expect(signHandoff(input, { secret: 'short', now: T0 })).rejects.toBeInstanceOf(SecretMissingError);
    await expect(signHandoff(input, { secret: undefined, now: T0 })).rejects.toBeInstanceOf(SecretMissingError);
  });
});
