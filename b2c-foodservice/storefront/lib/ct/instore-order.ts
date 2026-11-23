import 'server-only';
import type { CartUpdateAction } from '@commercetools/platform-sdk';
import { splitPickupName } from '@/lib/checkout/fulfilment-plan';
import type { InstoreOrderForm } from '@/lib/checkout/instore-form';
import { finalizeOrder } from '@/lib/checkout/finalize';
import { orderNumberForCart } from '@/lib/checkout/order-number';
import { apiRoot } from '@/lib/ct/client';
import { getOrderByNumber } from '@/lib/ct/orders';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import type { OrderView } from '@/lib/types';

/**
 * The In-store order without payment (D-062). The booth order is free ("no payment needed"), so there is no hosted Checkout, no
 * payment and no pay cookie: the session's bag becomes an order directly. Who it is for and how to tell them go on the bag first,
 * as its email and shipping address (the order copies both), so no custom field or type is needed:
 *  - name: first and last name; badge scan: no name (the scan is a placeholder until a badge reader exists);
 *  - email: the cart's `customerEmail` and the address email; phone: the address phone.
 * The order number is the bag's deterministic one, so a retry never makes a second order: a repeat finds the first.
 */
export async function placeInstoreOrder(session: Session, country: string, form: InstoreOrderForm): Promise<OrderView> {
  if (!session.cartId) throw new AppError('not_found', 404);
  const cartId = session.cartId;
  const orderNumber = orderNumberForCart(cartId);

  const existing = await getOrderByNumber(orderNumber);
  if (existing) return (await finalizeOrder({ orderId: existing.id })) as OrderView;

  const cart = await updateWithRetry(
    async () => (await apiRoot.carts().withId({ ID: cartId }).get().execute()).body,
    async (current) => {
      if (current.cartState !== 'Active') throw new AppError('not_found', 404);
      if (current.lineItems.length === 0) throw new AppError('validation_failed', 409);
      const names = form.who.mode === 'name' ? splitPickupName(form.who.name) : { firstName: '', lastName: '' };
      const actions: CartUpdateAction[] = [
        {
          action: 'setShippingAddress',
          address: {
            country: current.country ?? country,
            ...(names.firstName ? { firstName: names.firstName } : {}),
            ...(names.lastName ? { lastName: names.lastName } : {}),
            additionalAddressInfo: form.who.mode === 'badge' ? 'In-store order, badge scan' : 'In-store order',
            ...(form.notify.mode === 'email' ? { email: form.notify.email } : { phone: form.notify.phone }),
          },
        },
        form.notify.mode === 'email'
          ? { action: 'setCustomerEmail', email: form.notify.email }
          : { action: 'setCustomerEmail' },
      ];
      return (await apiRoot.carts().withId({ ID: cartId }).post({ body: { version: current.version, actions } }).execute()).body;
    },
  );

  const { body: order } = await apiRoot
    .orders()
    .post({ body: { cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber } })
    .execute();
  return (await finalizeOrder({ orderId: order.id })) as OrderView;
}
