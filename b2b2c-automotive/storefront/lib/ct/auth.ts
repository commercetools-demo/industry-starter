// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Customer sign-in of the storefront (workstream N-08, D8). Always the store scoped LOGIN endpoint, never `customers().login()`:
// a customer registered at another reseller is unknown here. The anonymous cart is passed as `anonymousCart` with
// `MergeWithExistingCustomerCart` (field names confirmed against the OAS `CustomerSignin`: `anonymousCart`, `anonymousCartSignInMode`,
// `anonymousId`; `anonymousCartId` is the deprecated spelling). `signIn` is the function the demo login (workstream Q) reuses.
import 'server-only';
import type { Cart as CtCart, Customer } from '@commercetools/platform-sdk';
import { recalculate } from '@/lib/ct/cart';
import { inStore } from '@/lib/ct/in-store';

/** One failure for every reason (wrong password, unknown email, customer of another store): the message never says which. */
export class AuthError extends Error {
  readonly code = 'invalid-credentials';
  constructor() {
    super('Invalid credentials');
    this.name = 'AuthError';
  }
}

export interface SignInInput {
  storeKey: string;
  email: string;
  password: string;
  /** The session's anonymous cart; merged into the customer's cart. */
  anonymousCartId?: string;
  anonymousId?: string;
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/** The customer and their cart after the merge (re-priced, D11), or `null` when they have no cart. Throws `AuthError` for bad credentials. */
export async function signIn(input: SignInInput): Promise<{ customer: Customer; cart: CtCart | null }> {
  try {
    const { body } = await inStore(input.storeKey)
      .login()
      .post({
        body: {
          email: input.email,
          password: input.password,
          ...(input.anonymousCartId ? { anonymousCart: { typeId: 'cart' as const, id: input.anonymousCartId }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' as const } : {}),
          ...(input.anonymousId ? { anonymousId: input.anonymousId } : {}),
        },
      })
      .execute();
    const cart = body.cart ? await recalculate(input.storeKey, body.cart.id) : null;
    return { customer: body.customer, cart };
  } catch (error) {
    // commercetools answers 400 InvalidCredentials for every reason above; anything else (outage, 5xx) is a real error.
    if (statusOf(error) === 400) throw new AuthError();
    throw error;
  }
}
