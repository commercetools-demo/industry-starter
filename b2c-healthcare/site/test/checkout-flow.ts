import type { CheckoutContext } from '@/lib/ct/checkout';
import type { FinalizeOutcome, PrepareOutcome } from '@/lib/ct/orders';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import type { FakeShop } from '@/test/fake-shop';

/**
 * The full-Checkout flow as the unit tests drive it: the gate (`prepareCheckout`), then "Checkout" - which the test
 * plays by creating the order from the cart in the fake shop, without an order number or a state, with the card Payment
 * authorized - then `finalizeOrder`, the browser callback. Takes the functions as arguments so each test file keeps its
 * own module mocks.
 */
export interface CheckoutFlowModule {
  prepareCheckout: (input: { ctx: CheckoutContext; cartId: string; expectedTotal: { centAmount: number; currencyCode: string } }, provider: PaymentProvider) => Promise<PrepareOutcome>;
  finalizeOrder: (orderId: string, options?: { provider?: PaymentProvider | null; now?: Date }) => Promise<FinalizeOutcome>;
}

export interface FlowInput {
  ctx: CheckoutContext;
  cartId: string;
  expectedTotal: { centAmount: number; currencyCode: string };
}

/** What Checkout does once the card is authorized: a card Payment with an `Authorization`/`Success` transaction on the cart, then the order. */
export async function checkoutCreatesOrder(shop: FakeShop, cartId: string, options: { cardCents?: number; declined?: boolean } = {}): Promise<{ id: string }> {
  const root = shop.apiRoot as { payments: () => { post: (a: unknown) => { execute: () => Promise<{ body: { id: string; version: number } }> } }; carts: () => { withId: (a: { ID: string }) => { post: (a: unknown) => { execute: () => Promise<{ body: { version: number } }> } } }; orders: () => { post: (a: unknown) => { execute: () => Promise<{ body: { id: string } }> } } };
  const cart = shop.carts.get(cartId)!;
  const total = cart.taxedPrice?.totalGross.centAmount ?? cart.totalPrice.centAmount;
  const tenders = (cart.paymentInfo?.payments ?? []).reduce((sum, ref) => sum + (shop.payments.get(ref.id)?.amountPlanned.centAmount ?? 0), 0);
  const card = options.cardCents ?? total - tenders;
  if (card > 0) {
    const { body } = await root
      .payments()
      .post({
        body: {
          amountPlanned: { currencyCode: 'USD', centAmount: card },
          paymentMethodInfo: { paymentInterface: 'stripe', method: 'card' },
          transactions: [{ id: 'tx-auth', type: 'Authorization', state: options.declined ? 'Failure' : 'Success', amount: { currencyCode: 'USD', centAmount: card } }],
        },
      })
      .execute();
    await root.carts().withId({ ID: cartId }).post({ body: { version: shop.carts.get(cartId)!.version, actions: [{ action: 'addPayment', payment: { typeId: 'payment', id: body.id } }] } }).execute();
  }
  const { body } = await root.orders().post({ body: { cart: { typeId: 'cart', id: cartId }, version: shop.carts.get(cartId)!.version } }).execute();
  return { id: body.id };
}

/**
 * Gate -> Checkout -> callback, in one call. Answers like the old single call did where the meaning is the same
 * (`{ ok: true, orderId, orderNumber, replay }`, or `{ ok: false, code }`).
 */
export function makePlaceOrder(shop: FakeShop, mod: CheckoutFlowModule) {
  return async function placeOrder(input: FlowInput, provider: PaymentProvider, options: { cardCents?: number } = {}): Promise<FinalizeOutcome | Extract<PrepareOutcome, { ok: false }>> {
    const gate = await mod.prepareCheckout(input, provider);
    if (!gate.ok) return gate;
    if (gate.kind === 'order') return { ok: true, replay: false, orderId: gate.orderId, orderNumber: gate.orderNumber };
    const order = await checkoutCreatesOrder(shop, input.cartId, options);
    return mod.finalizeOrder(order.id, { provider, now: input.ctx.now });
  };
}
