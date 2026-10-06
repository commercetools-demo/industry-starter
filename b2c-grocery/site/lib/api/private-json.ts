import { NextResponse } from 'next/server';

/** JSON for per-customer data: never stored by a shared cache or the browser. Used by every `/api/account/*` route. */
export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
