// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Verifier of the portal's "Shop as customer" handoff token (V-06). Equal to `verifyHandoff` of `portal/lib/impersonation/token.ts`:
// HS256 with the shared `IMPERSONATION_SECRET`, audience `storefront-impersonation`, `exp` 60 s after `iat`, claims `sub` (customer id),
// `store`, `actor` and `jti`. Pure (the secret is a parameter); the token and the secret are never logged or put in an error.
import { jwtVerify, SignJWT } from 'jose';

export const IMPERSONATION_AUDIENCE = 'storefront-impersonation';
export const HANDOFF_TTL_SECONDS = 60;

export interface HandoffClaims {
  /** The customer to shop as (`sub`). */
  customerId: string;
  storeKey: string;
  /** The seller user who started the session. */
  actorId: string;
  jti: string;
}

const ID = /^[A-Za-z0-9_-]{1,256}$/;

/** Verifies signature, algorithm, audience and expiry; throws for anything else (the caller shows the generic not-found page). */
export async function verifyHandoff(token: string, secret: Uint8Array, now: Date = new Date()): Promise<HandoffClaims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], audience: IMPERSONATION_AUDIENCE, currentDate: now });
  const { sub, store, actor, jti } = payload as { sub?: unknown; store?: unknown; actor?: unknown; jti?: unknown };
  if (typeof sub !== 'string' || typeof store !== 'string' || typeof actor !== 'string' || typeof jti !== 'string') throw new Error('Invalid handoff token');
  if (![sub, store, actor, jti].every((v) => ID.test(v))) throw new Error('Invalid handoff token');
  return { customerId: sub, storeKey: store, actorId: actor, jti };
}

/** Test helper: signs a token exactly as the portal does. Not used by the app. */
export async function signHandoffForTest(
  input: { customerId: string; storeKey: string; actorId: string; jti: string },
  secret: Uint8Array,
  options: { now?: Date; audience?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  return new SignJWT({ store: input.storeKey, actor: input.actorId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.customerId)
    .setAudience(options.audience ?? IMPERSONATION_AUDIENCE)
    .setJti(input.jti)
    .setIssuedAt(iat)
    .setExpirationTime(iat + (options.ttlSeconds ?? HANDOFF_TTL_SECONDS))
    .sign(secret);
}
