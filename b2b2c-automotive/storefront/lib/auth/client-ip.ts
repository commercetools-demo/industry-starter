// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The address the rate limiters key on (workstream X, Q-X09). A client can send any `x-forwarded-for` value; only what a proxy of the host
// APPENDS can be trusted, so the default reads the rightmost entry, not the first. Environment (read on every call, no secrets):
//   CLIENT_IP_HEADER     header with the client address; default `x-forwarded-for`. On a host that sets a single-value header
//                        (Netlify: `x-nf-client-connection-ip`; Vercel: `x-real-ip` or `x-vercel-forwarded-for`) name it here.
//   TRUSTED_PROXY_HOPS   proxies between the internet and the app that append to `x-forwarded-for`; default 1. The client address is
//                        the entry that many places from the right.
// A missing or malformed value is `unknown` (one shared bucket: stricter, never spoofable).

const ADDRESS = /^[0-9a-fA-F:.]{2,45}$/;

function hops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

export function clientIp(request: Request): string {
  const name = (process.env.CLIENT_IP_HEADER || 'x-forwarded-for').trim().toLowerCase();
  const raw = request.headers.get(name);
  if (!raw) return 'unknown';
  let value: string | undefined;
  if (name === 'x-forwarded-for') {
    const entries = raw.split(',').map((s) => s.trim());
    value = entries[Math.max(0, entries.length - hops())];
  } else {
    value = raw.split(',')[0]?.trim();
  }
  return value && ADDRESS.test(value) ? value : 'unknown';
}
