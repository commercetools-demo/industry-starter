// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { isAppLocale } from '@/i18n/config';
import { handle } from '@/lib/api';
import { clientIp } from '@/lib/auth/client-ip';
import { listResellers } from '@/lib/ct/resellers';
import { createRateLimiter } from '@/lib/rate-limit';
import { getLocale } from '@/lib/session';

// 60 requests per minute per client address. The list is public and the same for everyone.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** The resellers of the Malva finder (name, city, address, coordinates, branches). No session, no ids; `?locale=` picks the language of the names. */
export const GET = handle(async (request: Request) => {
  if (!limiter.allow(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  const asked = new URL(request.url).searchParams.get('locale');
  const locale = isAppLocale(asked) ? asked : (await getLocale()).locale;
  const resellers = await listResellers(locale);
  return Response.json({ resellers }, { headers: { 'Cache-Control': 'public, max-age=60' } });
});
