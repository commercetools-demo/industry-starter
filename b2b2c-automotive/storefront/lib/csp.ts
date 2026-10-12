// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Content-Security-Policy for the storefront (workstream I). Pure: imported by next.config.ts and by tests.
// The only third-party host for images is the OpenStreetMap tile server (store picker map). `connect-src` is `'self'`: the
// browser never calls commercetools, Contentools (it uses the same-origin proxy), tiles by fetch or the geocoder.
// Hosts for seller or catalogue images (product photos, logos) are added through CSP_IMG_HOSTS, never by loosening this file.

export const OSM_TILE_ORIGIN = 'https://tile.openstreetmap.org';

/** Valid https origins from a comma separated list (`CSP_IMG_HOSTS`); anything else is dropped. */
export function extraImageHosts(raw: string | undefined): string[] {
  const hosts: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const value = part.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password && (url.pathname === '/' || url.pathname === '')) hosts.push(url.origin);
    } catch {
      // ignore an invalid entry
    }
  }
  return [...new Set(hosts)];
}

export function buildCsp({ dev = false, imgHosts = [] }: { dev?: boolean; imgHosts?: string[] } = {}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js inlines its bootstrap scripts; `unsafe-eval` is for the dev server only (React refresh), never for Leaflet or production.
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', OSM_TILE_ORIGIN, ...imgHosts],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'frame-ancestors': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
