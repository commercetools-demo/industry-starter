// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// GET /api/locale: the active locale triple. POST /api/locale { locale }: switch locale, currency and country together.
import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from '@/i18n/config';
import { handle, parseJson } from '@/lib/api';
import { getLocale, updateSession } from '@/lib/session';
import { applyLocale } from '@/lib/session-core';

const body = z.object({ locale: z.enum(LOCALES, { message: 'Unsupported locale' }) });

export const GET = handle(async () => Response.json(await getLocale()));

export const POST = handle(async (request: Request) => {
  const { locale } = await parseJson(request, body);
  const session = await updateSession((s) => applyLocale(s, locale));
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
  return Response.json({ locale, currency: session.currency, country: session.country });
});
