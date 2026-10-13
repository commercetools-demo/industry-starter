// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Contentools JWT lives in a commercetools custom object (container `contentools-configuration`, key
// `contentools-jwt-token`, value a plain string). It is read and refreshed ONLY here, with the admin client, and never leaves
// the server: pages receive a boolean, the proxy attaches the token to write requests. The token is never logged.
// Pattern ported from b2b2c-starter/dealer/lib/contentools/jwt.ts.
import 'server-only';
import { cache } from 'react';
import { adminRoot } from '@/lib/ct/admin-client';
import { CONTENTOOLS_CONFIGURATION_CONTAINER, CONTENTOOLS_JWT_TOKEN_KEY } from '@/lib/ct/containers';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { CONTENTOOLS_ORIGIN } from './origin';

const REFRESH_TIMEOUT_MS = 5000;

function expiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when `token` is a three part JWT whose `exp` is more than `skewSeconds` ahead. */
export function isJwtValid(token: string | null, nowMs: number = Date.now(), skewSeconds = 60): token is string {
  if (!token) return false;
  const exp = expiryMs(token);
  return exp !== null && exp - skewSeconds * 1000 > nowMs;
}

interface StoredToken {
  token: string;
  version: number;
}

async function readStored(): Promise<StoredToken | null> {
  try {
    const { body } = await adminRoot.customObjects().withContainerAndKey({ container: CONTENTOOLS_CONFIGURATION_CONTAINER, key: CONTENTOOLS_JWT_TOKEN_KEY }).get().execute();
    return typeof body.value === 'string' ? { token: body.value, version: body.version } : null;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

async function refreshToken(old: string): Promise<string | null> {
  const response = await fetch(`${CONTENTOOLS_ORIGIN}/service/refresh-jwt`, {
    method: 'POST',
    headers: { authorization: `Bearer ${old}` },
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { token?: unknown };
  return typeof body.token === 'string' && isJwtValid(body.token) ? body.token : null;
}

/** Development fixtures only (PORTAL_DEV_FIXTURES=on, never production): an unsigned token the fake Contentools accepts. */
function devToken(): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: 'portal-dev-fixture', exp: Math.floor(Date.now() / 1000) + 3600 })}.dev`;
}

/**
 * Workstream X-12: a greppable fake token for the leak attack (E01 to E09). Honoured outside production, or in production only with
 * ATTACK_MODE=1 (scripts/check-no-attack-mode.mjs keeps both names out of every release configuration). Never a real token.
 */
export function canaryToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const canary = env.CONTENTOOLS_JWT_CANARY?.trim();
  if (!canary) return null;
  return env.NODE_ENV !== 'production' || env.ATTACK_MODE === '1' ? canary : null;
}

/** Uncached core of `getValidContentoolsJwt` (exported for tests). Returns null when absent or on any failure; never throws. */
export async function resolveContentoolsJwt(): Promise<string | null> {
  try {
    const canary = canaryToken();
    if (canary) return canary;
    if (devFixturesEnabled()) return devToken();
    const stored = await readStored();
    if (!stored) return null;
    if (isJwtValid(stored.token)) return stored.token;
    const fresh = await refreshToken(stored.token);
    if (!fresh) return null;
    await adminRoot
      .customObjects()
      .post({ body: { container: CONTENTOOLS_CONFIGURATION_CONTAINER, key: CONTENTOOLS_JWT_TOKEN_KEY, value: fresh, version: stored.version } })
      .execute();
    return fresh;
  } catch {
    // Nothing from the failure is logged: an error object can carry request headers.
    return null;
  }
}

/** The valid Contentools JWT, refreshed when it expires within a minute; `null` when Contentools is not connected. */
export const getValidContentoolsJwt: () => Promise<string | null> = cache(resolveContentoolsJwt);
