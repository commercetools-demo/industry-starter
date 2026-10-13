// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Customer registration for the guest "Create account" on the confirmation page (workstream P-05, D6). The customer is created in the
// store of the order (`/in-store/key=.../customers`), so a customer of another reseller never exists here. No email is verified or sent.
import 'server-only';
import type { Customer } from '@commercetools/platform-sdk';
import { inStore } from '@/lib/ct/in-store';

export const CUSTOMER_TYPE_KEY = 'malva-customer';

/** The email is already registered in this store. */
export class DuplicateCustomerError extends Error {
  constructor() {
    super('Duplicate customer');
    this.name = 'DuplicateCustomerError';
  }
}

const errorCodes = (error: unknown): string[] => ((error as { body?: { errors?: { code?: string }[] } })?.body?.errors ?? []).map((e) => e.code ?? '');
const statusOf = (error: unknown): number | undefined => (typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined);

export interface NewStoreCustomer {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  /** Extra `malva-customer` fields written at creation (workstream Q: `marketingConsent`, `marketingConsentAt`). */
  customFields?: Record<string, unknown>;
}

/**
 * Creates the customer with the seed's custom type `malva-customer` and none of its fields (the garage is written only by workstream J
 * when the shopper saves a vehicle). A duplicate email in this store throws `DuplicateCustomerError`.
 */
export async function createStoreCustomer(storeKey: string, input: NewStoreCustomer): Promise<Customer> {
  try {
    const { body } = await inStore(storeKey)
      .customers()
      .post({
        body: {
          email: input.email,
          password: input.password,
          // No email is ever sent (Q-P01), so nobody could confirm an address: accounts are created verified.
          isEmailVerified: true,
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          custom: { type: { typeId: 'type', key: CUSTOMER_TYPE_KEY }, fields: input.customFields ?? {} },
        },
      })
      .execute();
    return body.customer;
  } catch (error) {
    if (statusOf(error) === 400 && errorCodes(error).includes('DuplicateField')) throw new DuplicateCustomerError();
    throw error;
  }
}

/** Rolls a half-created account back (the order could not be attached). */
export async function deleteCustomer(storeKey: string, customerId: string, version: number): Promise<void> {
  await inStore(storeKey).customers().withId({ ID: customerId }).delete({ queryArgs: { version } }).execute();
}
