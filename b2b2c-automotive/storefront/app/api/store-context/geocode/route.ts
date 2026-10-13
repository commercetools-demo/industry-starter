// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { cookies } from 'next/headers';
import { isAppLocale } from '@/i18n/config';
import { ApiError, handle } from '@/lib/api';
import { clientIp } from '@/lib/auth/client-ip';
import { getShellContext } from '@/lib/ct/shell';
import { geocode } from '@/lib/geo/nominatim';
import { createRateLimiter } from '@/lib/rate-limit';
import { getLocale, getSession, SESSION_COOKIE } from '@/lib/session';

// 20 requests per minute per session. The visitor's IP, cookies and headers never reach the upstream.
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const CONTROL = /[\u0000-\u001f\u007f]/;

/** `GET ?q=`: a place name or postal code geocoded by Nominatim through the server (cached, queued, 1 request per second). */
export const GET = handle(async (request: Request) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 3 || q.length > 100 || CONTROL.test(q)) throw new ApiError(400, 'Invalid query');

  const jar = await cookies();
  const key = jar.get(SESSION_COOKIE)?.value ?? clientIp(request);
  if (!limiter.allow(key)) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });

  const session = await getSession();
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const asked = url.searchParams.get('locale');
  const locale = isAppLocale(asked) ? asked : (await getLocale()).locale;
  const ctx = await getShellContext(session.storeKey, locale);
  if (!ctx) throw new ApiError(404, 'Not found');

  const outcome = await geocode(q, { countries: ctx.countries, locale });
  return Response.json(outcome, { headers: { 'Cache-Control': outcome.unavailable ? 'no-store' : 'private, max-age=600' } });
});
