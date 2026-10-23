import 'server-only';
import type { Session } from '@/lib/session';

/**
 * The session after a login or registration: customer fields set, the cart of the result (or the one the session had),
 * the anonymous id dropped (the customer owns it now). No commercetools token is ever stored.
 * Market and store choices are kept.
 */
export function sessionFromLogin(result: { customer: { id: string; email: string; firstName?: string; lastName?: string }; cart?: { id: string } }, session: Session): Session {
  const { anonymousId: _anonymousId, ...rest } = session;
  void _anonymousId;
  const cartId = result.cart?.id ?? session.cartId;
  return {
    ...rest,
    customerId: result.customer.id,
    customerEmail: result.customer.email,
    customerFirstName: result.customer.firstName ?? '',
    customerLastName: result.customer.lastName ?? '',
    ...(cartId ? { cartId } : {}),
  };
}

/** The session after sign-out: market and store survive, everything about the person and the cart goes. */
export function sessionAfterLogout(session: Session): Session {
  const next: Session = {};
  if (session.country) next.country = session.country;
  if (session.currency) next.currency = session.currency;
  if (session.locale) next.locale = session.locale;
  if (session.collectionStoreKey) next.collectionStoreKey = session.collectionStoreKey;
  return next;
}
