import { CUSTOMER_TYPE_PRIORITY, GROUP_EXISTING_CUSTOMER } from '@/lib/config/eligibility';
import type { BuyerContext, CustomerType } from '@/lib/types';

// Pure. What an anonymous visitor says about themselves. It is a declaration, never a credential: a value outside the allowed
// ones is ignored, and a signed-in customer's account always governs (the caller decides, this module only parses and maps).

export type DeclaredExisting = 'yes' | 'no' | 'unspecified';
export interface Declared {
  customerType: CustomerType;
  existing: DeclaredExisting;
}

export const DEFAULT_DECLARED: Declared = { customerType: 'consumer', existing: 'unspecified' };

const EXISTING: readonly DeclaredExisting[] = ['yes', 'no', 'unspecified'];

export const isCustomerType = (value: unknown): value is CustomerType => typeof value === 'string' && (CUSTOMER_TYPE_PRIORITY as readonly string[]).includes(value);
export const isDeclaredExisting = (value: unknown): value is DeclaredExisting => typeof value === 'string' && (EXISTING as readonly string[]).includes(value);

/** `employee:yes`. Anything malformed gives the default; each half is checked on its own. */
export function parseDeclared(raw: string | undefined): Declared {
  if (!raw) return DEFAULT_DECLARED;
  const [type, existing] = raw.split(':');
  return { customerType: isCustomerType(type) ? type : DEFAULT_DECLARED.customerType, existing: isDeclaredExisting(existing) ? existing : DEFAULT_DECLARED.existing };
}

export const serializeDeclared = (declared: Declared): string => `${declared.customerType}:${declared.existing}`;

/** The customer group an anonymous cart carries (a cart has one): employee, then small business, then existing customer, else none. */
export function groupKeyOf(customerType: CustomerType, existingCustomer: boolean): string | null {
  if (customerType !== 'consumer') return customerType;
  return existingCustomer ? GROUP_EXISTING_CUSTOMER : null;
}

/** The group to put on this buyer's cart: none for a signed-in customer (the customer's own groups apply). */
export const cartGroupKeyOf = (buyer: Pick<BuyerContext, 'signedIn' | 'customerType' | 'isExistingCustomer'>): string | null => (buyer.signedIn ? null : groupKeyOf(buyer.customerType, buyer.isExistingCustomer));
