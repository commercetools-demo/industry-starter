import 'server-only';
import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';

const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: unknown } | undefined;
  return typeof x?.statusCode === 'number' ? x.statusCode : undefined;
};

/** The customer does not exist (any more). */
export class CustomerNotFoundError extends Error {
  constructor() {
    super('customer not found');
    this.name = 'CustomerNotFoundError';
  }
}

/** Reads the customer. */
export async function readCustomer(customerId: string): Promise<Customer> {
  try {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) throw new CustomerNotFoundError();
    throw error;
  }
}

/**
 * Optimistic-concurrency update: reads the CURRENT customer, lets `plan` choose the actions from it (return an empty
 * list for "nothing to do"), posts with that version, and retries once on a 409. Returns the resulting customer.
 */
export async function updateCustomer(customerId: string, plan: (customer: Customer) => CustomerUpdateAction[]): Promise<Customer> {
  for (let attempt = 0; ; attempt += 1) {
    const customer = await readCustomer(customerId);
    const actions = plan(customer);
    if (actions.length === 0) return customer;
    try {
      const { body } = await apiRoot.customers().withId({ ID: customerId }).post({ body: { version: customer.version, actions } }).execute();
      return body;
    } catch (error) {
      if (statusOf(error) === 409 && attempt === 0) continue;
      throw error;
    }
  }
}
