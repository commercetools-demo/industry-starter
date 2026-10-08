import 'server-only';
import type { CustomerUpdateAction } from '@commercetools/platform-sdk';
import { updateCustomer } from '@/lib/ct/customer-update';
import type { AccountUser } from '@/lib/types';

/**
 * Changes the patient's first and last name (the only profile fields a patient edits; the email stays: changing it
 * would de-verify the account). Unchanged names make no update call.
 */
export async function updateName(customerId: string, name: { firstName: string; lastName: string }): Promise<AccountUser> {
  const customer = await updateCustomer(customerId, (current) => {
    const actions: CustomerUpdateAction[] = [];
    if (current.firstName !== name.firstName) actions.push({ action: 'setFirstName', firstName: name.firstName });
    if (current.lastName !== name.lastName) actions.push({ action: 'setLastName', lastName: name.lastName });
    return actions;
  });
  return { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email };
}
