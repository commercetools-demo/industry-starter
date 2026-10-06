import 'server-only';
import type { Customer as CtCustomer } from '@commercetools/platform-sdk';
import type { SavedAddress } from '../types';
import { mapAddress } from './cart';

/** The customer's address book. Default flags come from `defaultShippingAddressId` / `defaultBillingAddressId`; addresses without an id are skipped. */
export function mapAddresses(customer: Pick<CtCustomer, 'addresses' | 'defaultShippingAddressId' | 'defaultBillingAddressId'>): SavedAddress[] {
  const out: SavedAddress[] = [];
  for (const a of customer.addresses ?? []) {
    if (!a.id) continue;
    out.push({
      ...mapAddress(a),
      id: a.id,
      isDefaultShipping: a.id === customer.defaultShippingAddressId,
      isDefaultBilling: a.id === customer.defaultBillingAddressId,
      ...(a.key ? { key: a.key } : {}),
    });
  }
  return out;
}
