import 'server-only';
import { type CartMarket, createCart, getCartForSession } from '@/lib/ct/cart';
import type { Session } from '@/lib/session';

/**
 * The shopper's bag for the assistant, made when the assistant session starts (workstream T2, decision 5). A Route Handler cannot set a
 * cookie after a streamed body has begun, so a new cart id must reach the cookie here, before the stream. A shopper with an active bag keeps
 * it: the same session object comes back. A failure is logged by name only and the session still starts; the cart tools then answer
 * "reload the page".
 */
export async function ensureAssistantBag(session: Session, market: CartMarket): Promise<Session> {
  try {
    if (session.cartId && (await getCartForSession(session))) return session;
    return (await createCart(session, market)).session;
  } catch {
    console.warn(JSON.stringify({ event: 'assistant_bag_create_failed' }));
    return session;
  }
}
