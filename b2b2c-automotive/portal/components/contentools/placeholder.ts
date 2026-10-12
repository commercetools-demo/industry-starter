// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The `jwtToken` the managers receive. The real Contentools JWT stays on the server and the proxy attaches it; whatever the
// browser sends as Authorization is dropped there. The managers only forward the string as `Bearer <token>`, so a plain
// marker works (Q-U02: verified against puck-api 0.8.x, which never decodes it).

export const PLACEHOLDER_TOKEN = 'server-managed';

/**
 * An unsigned JWT-shaped placeholder (header.payload.signature) with a far-future `exp` and no claims, for a manager version that
 * decodes the token. It carries no `sub` and no secret. Not used while PLACEHOLDER_TOKEN works.
 */
export function placeholderJwt(): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp: 4102444800 })}.placeholder`;
}
