import 'server-only';
import { applyLocale } from '../locale-write';
import { getSession, saveSession, type Session } from '../session';
import { clearCart, setCart } from '../session-core';
import { COUNTRY_CONFIG, isSupportedLocale } from '../utils';

/**
 * The session as this request sees it. The page's locale decides the currency of the list: a visitor who opened a
 * `/de-DE` link directly has a USD session, so the request names its locale and the list follows it.
 * Unlike `applyLocale`, the cart id is kept here; the list code starts the list again in the new currency.
 */
export async function sessionFor(requested?: unknown): Promise<Session> {
  const session = await getSession();
  if (!isSupportedLocale(requested) || requested === session.locale) return session;
  const target = COUNTRY_CONFIG[requested]!;
  return { ...applyLocale(session, { locale: target.locale, currency: target.currency, country: target.country }), ...(session.cartId ? { cartId: session.cartId } : {}) };
}

/** Writes the cookie only when something changed: the cart id or the locale fields. */
export async function persistList(original: Session, effective: Session, cartId: string | undefined): Promise<Session> {
  const next = cartId ? setCart(effective, cartId) : clearCart(effective);
  const changed = (['cartId', 'locale', 'currency', 'country'] as const).some((k) => next[k] !== original[k]);
  if (changed) await saveSession(next);
  return next;
}
