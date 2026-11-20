import 'server-only';
import type { Cart, Customer } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';

export interface SignInResult { customer: Customer; cart?: Cart }

/**
 * Global (not in-store) customer sign-in, Q-J-02. The guest cart and guest id are passed only when the session has
 * them, so lines are kept (MergeWithExistingCustomerCart, Q-J-11) and anonymous orders attach to the customer.
 */
export async function signIn(
  email: string,
  password: string,
  guest: { cartId?: string; anonymousId?: string } = {},
): Promise<SignInResult> {
  const { body } = await apiRoot
    .login()
    .post({
      body: {
        email,
        password,
        ...(guest.cartId ? { anonymousCart: { typeId: 'cart' as const, id: guest.cartId } } : {}),
        ...(guest.anonymousId ? { anonymousId: guest.anonymousId } : {}),
        ...(guest.cartId ? { anonymousCartSignInMode: 'MergeWithExistingCustomerCart' as const } : {}),
        updateProductData: true,
      },
    })
    .execute();
  return { customer: body.customer, cart: body.cart };
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
