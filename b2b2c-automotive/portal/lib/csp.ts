// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Content-Security-Policy of the Partner Portal (workstream X, G01). Pure: imported by next.config.ts and by tests.
//
// Documented relaxations (every one has a reason):
//   script-src 'unsafe-inline'  Next.js inlines its bootstrap and hydration scripts and this app sends no nonce. `unsafe-eval` is
//                               never allowed in production (React refresh in development only).
//   style-src 'unsafe-inline'   Chakra and Nimbus (emotion) and the Contentools managers inject style tags at runtime.
//   img-src https:              catalogue, tailored and uploaded images come from several hosts (Contentools object store, seeded
//                               image hosts); an image cannot run code. Plus data: and blob: for previews and uploads, and the
//                               OpenStreetMap tile host of the branch map (Leaflet).
//   frame-src <storefront>      the live preview iframe frames the storefront (STOREFRONT_ORIGIN) and nothing else.
// connect-src is 'self': the browser never calls commercetools, Contentools or the geocoder directly (same-origin /api routes).
// The portal itself may be framed by nobody (frame-ancestors 'none', plus X-Frame-Options: DENY from lib/security/headers.ts).

export const OSM_TILE_ORIGIN = 'https://tile.openstreetmap.org';

/** A bare origin (`https://shop.example.com`) from a configured address, else undefined. */
export function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildCsp({ dev = false, storefrontOrigin }: { dev?: boolean; storefrontOrigin?: string } = {}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'frame-src': ["'self'", ...(storefrontOrigin ? [storefrontOrigin] : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
