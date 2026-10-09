import 'server-only';
import type { Cart, Customer } from '@commercetools/platform-sdk';
import { apiRoot } from './client';

export interface LoginResult { customer: Customer; cart?: Cart }

/**
 * Sign in through the login endpoint (not the per-customer login of the customers resource), merging the visitor's anonymous cart so the quote list survives.
 * Returns null for wrong credentials, whichever of email and password is wrong.
 */
export async function loginCustomer(email: string, password: string, anonymousCartId?: string): Promise<LoginResult | null> {
  try {
    const { body } = await apiRoot.login().post({
      body: {
        email, password,
        ...(anonymousCartId ? { anonymousCart: { typeId: 'cart' as const, id: anonymousCartId }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' as const } : {}),
        updateProductData: false,
      },
    }).execute();
    return { customer: body.customer, cart: body.cart };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 400 || status === 404) return null;
    throw error;
  }
}
