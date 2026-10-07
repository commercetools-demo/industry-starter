import 'server-only';
import type { Customer } from '@commercetools/platform-sdk';
import type { AccountUser } from '@/lib/types';

/** commercetools customer -> what the browser may know. Never includes the password hash, tokens or custom fields. */
export function mapCustomer(customer: Customer): AccountUser {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName?.trim() ?? '',
    lastName: customer.lastName?.trim() ?? '',
    ...(customer.customerNumber ? { customerNumber: customer.customerNumber } : {}),
    isEmailVerified: customer.isEmailVerified,
    createdAt: customer.createdAt,
  };
}
