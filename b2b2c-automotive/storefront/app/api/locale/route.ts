// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from '@/i18n/config';
import { handle, parseJson } from '@/lib/api';
import { getLocale, updateSession } from '@/lib/session';
import { applyLocale } from '@/lib/session-core';
import { COUNTRY_CONFIG } from '@/lib/utils';

const body = z.object({ locale: z.enum(LOCALES, { error: 'Unsupported locale' }) });

export const GET = handle(async () => Response.json(await getLocale()));

/** Switches locale, currency and country together; the cart is dropped when the currency changes. */
export const POST = handle(async (request: Request) => {
  const { locale } = await parseJson(request, body);
  await updateSession((s) => applyLocale(s, locale));
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
  const { currency, country } = COUNTRY_CONFIG[locale];
  return Response.json({ locale, currency, country });
});
