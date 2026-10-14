// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The static security headers both apps send on every response (workstream X, group G). The Content-Security-Policy is
// built per app (`lib/csp.ts`). Pure: imported by next.config.ts and by tests. Identical copy in storefront/ and portal/.

export interface HeaderPair {
  key: string;
  value: string;
}

export interface SecurityHeaderOptions {
  /** `DENY` for an app nobody may frame; omit when frame-ancestors in the CSP names the one allowed parent (the storefront preview). */
  frameOptions?: 'DENY';
  /** Allow the browser location prompt for the page itself (the storefront store picker). */
  geolocation?: boolean;
  production?: boolean;
}

export function securityHeaders({ frameOptions, geolocation = false, production = false }: SecurityHeaderOptions = {}): HeaderPair[] {
  const headers: HeaderPair[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: `camera=(), microphone=(), payment=(), usb=(), geolocation=${geolocation ? '(self)' : '()'}` },
  ];
  if (frameOptions) headers.push({ key: 'X-Frame-Options', value: frameOptions });
  // Only meaningful over HTTPS; browsers ignore it on http://localhost. Sent in production builds only.
  if (production) headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
  return headers;
}
