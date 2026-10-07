import { NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/session';
import { getValidCountryConfig } from '@/lib/ct/locale-validation';
import { LOCALE_COOKIE } from '@/lib/utils';

/** Atomic market switch: locale, currency and country change together; a currency change drops the cart. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  // Only markets that are also valid for the commercetools project (country, currency and language) are accepted.
  const config = typeof body?.locale === 'string' ? (await getValidCountryConfig())[body.locale] : undefined;
  if (!config) return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });

  const session = await getSession();
  const res = NextResponse.json({ locale: config.locale, currency: config.currency, country: config.country });
  const currencyChanged = !!session.currency && session.currency !== config.currency;
  await updateSession(
    { locale: config.locale, currency: config.currency, country: config.country, ...(currencyChanged ? { cartId: undefined } : {}) },
    res,
  );
  res.cookies.set(LOCALE_COOKIE, config.locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
