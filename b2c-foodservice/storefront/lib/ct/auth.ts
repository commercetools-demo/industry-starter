import 'server-only';
import type { Cart, Customer } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { CART_SHIPPING_MODE } from '@/lib/shop-config';

export interface SignInResult { customer: Customer; cart?: Cart }

const isMultiple = (cart: Pick<Cart, 'shippingMode'> | undefined): boolean => cart?.shippingMode === CART_SHIPPING_MODE;

/** True when the guest cart can be carried into the customer's account: it exists, is Active and has the shop's shipping mode (D-062). */
async function guestCartUsable(cartId: string): Promise<boolean> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get().execute();
    return body.cartState === 'Active' && isMultiple(body);
  } catch {
    return false;
  }
}

/**
 * The shipping mode of the customer's most recently modified Active cart (the one a sign-in would merge into), looked up by email,
 * or null when they have none. Throws when the lookup fails; the caller then does not merge.
 */
async function latestCartModeOf(email: string): Promise<Cart['shippingMode'] | null> {
  const customers = await apiRoot.customers().get({ queryArgs: { where: 'lowercaseEmail=:email', 'var.email': email.trim().toLowerCase(), limit: 1 } }).execute();
  const customerId = customers.body.results[0]?.id;
  if (!customerId) return null;
  const carts = await apiRoot
    .carts()
    .get({ queryArgs: { where: 'customerId=:id and cartState="Active"', 'var.id': customerId, sort: 'lastModifiedAt desc', limit: 1 } })
    .execute();
  return carts.body.results[0]?.shippingMode ?? null;
}

/**
 * Global (not in-store) customer sign-in, Q-J-02. The guest cart and guest id are passed only when the session has them, so lines
 * are kept and anonymous orders attach to the customer.
 *
 * Only carts in the shop's shipping mode are used (D-062, nothing is migrated):
 *  - a guest cart of another mode is not sent, so it is never merged into the account;
 *  - when the customer's latest Active cart is of another mode (an old `Single` cart), the guest cart is used as the new active cart
 *    instead of merged into it (`UseAsNewActiveCustomerCart`), so guest lines never land in an old cart;
 *  - the cart of the result is returned only when it has the shop's mode; otherwise the account starts with no bag.
 */
export async function signIn(
  email: string,
  password: string,
  guest: { cartId?: string; anonymousId?: string } = {},
): Promise<SignInResult> {
  const sendCart = guest.cartId && (await guestCartUsable(guest.cartId)) ? guest.cartId : undefined;
  let mode: 'MergeWithExistingCustomerCart' | 'UseAsNewActiveCustomerCart' = 'MergeWithExistingCustomerCart';
  if (sendCart) {
    try {
      const latest = await latestCartModeOf(email);
      if (latest !== null && latest !== CART_SHIPPING_MODE) mode = 'UseAsNewActiveCustomerCart';
    } catch {
      mode = 'UseAsNewActiveCustomerCart'; // unknown: never risk merging into an old cart
    }
  }
  const { body } = await apiRoot
    .login()
    .post({
      body: {
        email,
        password,
        ...(sendCart ? { anonymousCart: { typeId: 'cart' as const, id: sendCart }, anonymousCartSignInMode: mode } : {}),
        ...(guest.anonymousId ? { anonymousId: guest.anonymousId } : {}),
        updateProductData: true,
      },
    })
    .execute();
  return { customer: body.customer, ...(isMultiple(body.cart) && body.cart ? { cart: body.cart } : {}) };
}

export interface NewCustomer { email: string; password: string; firstName: string; lastName: string; locale?: string }

/** Created verified (D-032). The caller signs in straight afterwards; the guest cart is merged there, not here. */
export async function createCustomer(draft: NewCustomer): Promise<Customer> {
  const { body } = await apiRoot
    .customers()
    .post({
      body: {
        email: draft.email,
        password: draft.password,
        firstName: draft.firstName,
        lastName: draft.lastName,
        ...(draft.locale ? { locale: draft.locale } : {}),
        isEmailVerified: true,
      },
    })
    .execute();
  return body.customer;
}

export async function getCustomerById(id: string): Promise<Customer> {
  const { body } = await apiRoot.customers().withId({ ID: id }).get().execute();
  return body;
}
