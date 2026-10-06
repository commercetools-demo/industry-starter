import 'server-only';
import type { Customer as CtCustomer } from '@commercetools/platform-sdk';
import type { AccountProfile } from '../types';
import { mapAddress } from './cart';

/** What the dashboard needs from a customer: never the password hash, tokens or the raw address list. */
export function mapProfile(customer: CtCustomer): AccountProfile {
  const defaultId = customer.defaultShippingAddressId;
  const address = defaultId ? customer.addresses.find((a) => a.id === defaultId) : undefined;
  return {
    createdAt: customer.createdAt,
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    email: customer.email,
    ...(address ? { defaultShippingAddress: mapAddress(address) } : {}),
  };
}
