import { cookies } from 'next/headers';
import { handle, ok, parseBody } from '@/lib/api';
import { localeSchema } from '@/lib/schemas';
import { rebuildQuoteList } from '@/lib/ct/quote-list';
import { applyLocale } from '@/lib/locale-write';
import { getSession, saveSession } from '@/lib/session';
import { setCart } from '@/lib/session-core';
import { QUOTE_LIST_NOTICE_COOKIE } from '@/lib/quote/constants';
import { COUNTRY_CONFIG, LOCALE_COOKIE } from '@/lib/utils';

/**
 * Region and language switch: locale, currency and country are written together. A cart cannot change currency, so when the
 * currency changes the quote list is started again in the new one with the same services, frequencies and notes (malva-locale-routing ›
 * Quote list on switch); if that fails the switch still happens and the list starts empty.
 */
export const POST = handle(async (request: Request) => {
  const { locale } = await parseBody(request, localeSchema, 'Unsupported locale.');
  const target = COUNTRY_CONFIG[locale]!;
  const session = await getSession();
  let next = applyLocale(session, { locale: target.locale, currency: target.currency, country: target.country });
  const currencyChanged = session.currency !== target.currency;
  let rebuilt = false;
  if (currencyChanged && session.cartId) {
    try {
      const result = await rebuildQuoteList({ ...next, cartId: session.cartId });
      if (result.cartId) { next = setCart(next, result.cartId); rebuilt = true; }
    } catch (error) {
      console.error('quote list could not be started again after the locale switch', error instanceof Error ? error.name : 'unknown');
    }
  }
  await saveSession(next);
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, target.locale, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  if (rebuilt) jar.set(QUOTE_LIST_NOTICE_COOKIE, '1', { path: '/', sameSite: 'lax', maxAge: 60 * 10 });
  return ok({ locale: target.locale, currency: target.currency, country: target.country, cartReset: currencyChanged && Boolean(session.cartId) && !rebuilt, quoteListRebuilt: rebuilt, previousCartId: currencyChanged ? session.cartId ?? null : null });
});
