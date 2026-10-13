// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Handoff token of "Shop as customer" (workstream V-06, D4). The portal signs a short-lived, single-use token and the browser POSTs it
// in a form body to the storefront (never in a URL). Contract for the storefront (`/api/impersonate`, deferred, see
// plans/MISSED-FEATURES.md): verify HS256 with the shared `IMPERSONATION_SECRET` (32+ characters), audience `storefront-impersonation`,
// `exp` (60 s after `iat`), then load the custom object `malva-impersonation/<jti>`, require `status === 'issued'` and its `storeKey` to
// equal the store of the target path, set it to `active` and start the storefront session with the customer from `sub`.
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

export const IMPERSONATION_AUDIENCE = 'storefront-impersonation';
/** Lifetime of the handoff token. */
export const HANDOFF_TTL_SECONDS = 60;
/** Idle limit and absolute cap of the storefront session that follows (the storefront enforces them). */
export const IMPERSONATION_IDLE_SECONDS = 120;
export const IMPERSONATION_ABSOLUTE_SECONDS = 30 * 60;
export const SECRET_MIN_LENGTH = 32;

export interface HandoffClaims {
  /** The customer to shop as (JWT `sub`). */
  customerId: string;
  storeKey: string;
  /** The seller user who starts the session. */
  actorId: string;
  jti: string;
}

export class SecretMissingError extends Error {
  constructor() {
    super('IMPERSONATION_SECRET must be set to at least 32 characters');
    this.name = 'SecretMissingError';
  }
}

function key(secret: string | undefined): Uint8Array {
  if (!secret || secret.length < SECRET_MIN_LENGTH) throw new SecretMissingError();
  return new TextEncoder().encode(secret);
}

export const handoffSecret = (env: NodeJS.ProcessEnv = process.env): string | undefined => env.IMPERSONATION_SECRET;

export async function signHandoff(
  input: { customerId: string; storeKey: string; actorId: string },
  options: { secret?: string; now?: Date; jti?: string } = {},
): Promise<{ token: string; jti: string; expiresAt: string }> {
  const now = options.now ?? new Date();
  const iat = Math.floor(now.getTime() / 1000);
  const jti = options.jti ?? crypto.randomUUID();
  const token = await new SignJWT({ store: input.storeKey, actor: input.actorId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.customerId)
    .setAudience(IMPERSONATION_AUDIENCE)
    .setJti(jti)
    .setIssuedAt(iat)
    .setExpirationTime(iat + HANDOFF_TTL_SECONDS)
    .sign(key(options.secret ?? handoffSecret()));
  return { token, jti, expiresAt: new Date((iat + HANDOFF_TTL_SECONDS) * 1000).toISOString() };
}

/** Verifies signature, audience and expiry; throws for anything else. The storefront keeps an equal verifier. */
export async function verifyHandoff(token: string, options: { secret?: string; now?: Date } = {}): Promise<HandoffClaims> {
  const { payload } = await jwtVerify(token, key(options.secret ?? handoffSecret()), {
    algorithms: ['HS256'],
    audience: IMPERSONATION_AUDIENCE,
    currentDate: options.now ?? new Date(),
  });
  const { sub, store, actor, jti } = payload as { sub?: unknown; store?: unknown; actor?: unknown; jti?: unknown };
  if (typeof sub !== 'string' || typeof store !== 'string' || typeof actor !== 'string' || typeof jti !== 'string') throw new Error('Invalid handoff token');
  return { customerId: sub, storeKey: store, actorId: actor, jti };
}
