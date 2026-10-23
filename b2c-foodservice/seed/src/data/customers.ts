// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ShoppingListDraft } from '@commercetools/platform-sdk';
import { K, MARKETS, ls, type Country } from './base';
import { productByCode } from './products';

/** Six synthetic demo customers (SEED-PLAN section 13, D-030): four in the US, two in Canada. Every address is invented. */
export interface CustomerDef {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  country: Country;
  street: { streetName: string; streetNumber: string; postalCode: string; city: string; state?: string };
}

export const CUSTOMERS: CustomerDef[] = [
  { key: 'mcf-customer-maya', email: 'maya.okonkwo@example.com', firstName: 'Maya', lastName: 'Okonkwo', country: 'US', street: { streetName: 'Example Street', streetNumber: '100', postalCode: '10012', city: 'New York', state: 'NY' } },
  { key: 'mcf-customer-liam', email: 'liam.carter@example.com', firstName: 'Liam', lastName: 'Carter', country: 'US', street: { streetName: 'Sample Avenue', streetNumber: '25', postalCode: '94110', city: 'San Francisco', state: 'CA' } },
  { key: 'mcf-customer-priya', email: 'priya.nair@example.com', firstName: 'Priya', lastName: 'Nair', country: 'CA', street: { streetName: 'Example Street', streetNumber: '88', postalCode: 'M5V 2T6', city: 'Toronto', state: 'ON' } },
  { key: 'mcf-customer-lucas', email: 'lucas.tremblay@example.com', firstName: 'Lucas', lastName: 'Tremblay', country: 'CA', street: { streetName: 'Sample Avenue', streetNumber: '14', postalCode: 'V6B 1A1', city: 'Vancouver', state: 'BC' } },
  { key: 'mcf-customer-ava', email: 'ava.mackenzie@example.com', firstName: 'Ava', lastName: 'MacKenzie', country: 'CA', street: { streetName: 'Example Road', streetNumber: '301', postalCode: 'H2Y 1C6', city: 'Montreal', state: 'QC' } },
  { key: 'mcf-customer-noah', email: 'noah.patel@example.com', firstName: 'Noah', lastName: 'Patel', country: 'US', street: { streetName: 'Sample Boulevard', streetNumber: '9', postalCode: '60614', city: 'Chicago', state: 'IL' } },
];

export const customerDraft = (c: CustomerDef, password: string): Record<string, unknown> => {
  const address = { country: c.country, firstName: c.firstName, lastName: c.lastName, email: c.email, ...c.street };
  return {
    key: c.key, email: c.email, password, firstName: c.firstName, lastName: c.lastName, locale: MARKETS[c.country].locale, isEmailVerified: true,
    addresses: [address], defaultShippingAddress: 0, defaultBillingAddress: 0, shippingAddresses: [0], billingAddresses: [0],
  };
};

/** Saved-items list of Maya (the "saved items" feature of the account area). Line items use SKUs, so they resolve to the seeded variants. */
export const shoppingListDraft = (): ShoppingListDraft => ({
  key: K.savedMaya,
  name: ls('Saved items'),
  slug: ls('saved-items-maya'),
  customer: { typeId: 'customer', key: 'mcf-customer-maya' },
  lineItems: ['POD-EMBER', 'COF-HOUSE', 'MAC-POD1'].map((code) => ({ sku: productByCode(code).variants[0]?.sku as string, quantity: 1 })),
});
