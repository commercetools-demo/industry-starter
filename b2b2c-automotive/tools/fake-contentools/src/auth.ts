// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { IncomingHttpHeaders } from 'node:http';
import { HttpError } from './errors.ts';
import type { FakeOptions } from './state.ts';

const ISSUER = 'multitenant-contentools';

function isRegistered(options: FakeOptions, projectKey: string): boolean {
  return options.projectKeys === '*' || options.projectKeys.includes(projectKey);
}

function assertProject(options: FakeOptions, projectKey: string): void {
  if (!isRegistered(options, projectKey)) throw new HttpError(403, 'Project not found or not registered');
  if (options.inactiveProjectKeys.includes(projectKey)) throw new HttpError(403, 'Project is inactive');
}

/** Port of `requireProjectKey` (middleware/project-key.middleware.ts): used by every read route. */
export function requireProjectKey(options: FakeOptions, headers: IncomingHttpHeaders): string {
  const raw = headers['x-project-key'];
  const value = typeof raw === 'string' ? raw.trim() : undefined;
  if (!value) throw new HttpError(400, 'x-project-key header is required');
  assertProject(options, value);
  return value;
}

interface Claims {
  sub?: unknown;
  exp?: unknown;
  iss?: unknown;
  aud?: unknown;
}

function decodeClaims(token: string): Claims {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) throw new HttpError(401, 'Invalid JWT token: jwt malformed');
  try {
    const header = JSON.parse(Buffer.from(parts[0] as string, 'base64url').toString('utf8')) as unknown;
    const payload = JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf8')) as unknown;
    if (typeof header !== 'object' || header === null || typeof payload !== 'object' || payload === null) {
      throw new Error('not an object');
    }
    return payload as Claims;
  } catch {
    throw new HttpError(401, 'Invalid JWT token: invalid token');
  }
}

/**
 * Port of `validateJwt` + `validateProject` (middleware/jwt.middleware.ts, project.middleware.ts), used by every write
 * route. The fake never verifies the signature (it has no secret). In `jwt` mode the token must be a three-part JWT
 * with a `sub` claim; an `exp` in the past, a foreign `iss` or `aud` are rejected like the real service. In `lenient`
 * mode any non-empty bearer token passes. Returns the project key (the `sub` claim, or `unknown-project`).
 */
export function validateJwt(options: FakeOptions, headers: IncomingHttpHeaders, ignoreExpiry = false): string {
  const header = headers.authorization;
  if (!header) throw new HttpError(401, 'Authorization header missing');
  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Invalid authorization format. Expected: Bearer <token>');
  }
  const token = header.substring(7);
  if (!token) throw new HttpError(401, 'JWT token missing');
  if (options.jwtMode === 'lenient') return 'unknown-project';

  const claims = decodeClaims(token);
  if (!ignoreExpiry && typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) throw new HttpError(401, 'JWT token has expired');
  if (typeof claims.sub !== 'string' || claims.sub === '') {
    throw new HttpError(401, 'Invalid token: missing project key (sub claim)');
  }
  if (claims.iss && claims.iss !== ISSUER) throw new HttpError(401, 'Invalid token issuer');
  if (claims.aud && claims.aud !== ISSUER) throw new HttpError(401, 'Invalid token audience');
  assertProject(options, claims.sub);
  return claims.sub;
}
