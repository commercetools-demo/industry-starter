// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ShoppingListDraft } from '@commercetools/platform-sdk';
import { K, MARKETS, ls, type Country } from './base';
import { productByCode } from './products';

/** Six synthetic demo customers (SEED-PLAN section 13), two per market. Every address is invented. */
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
  { key: 'mcf-customer-anna', email: 'anna.schneider@example.com', firstName: 'Anna', lastName: 'Schneider', country: 'DE', street: { streetName: 'Beispielstraße', streetNumber: '12', postalCode: '10115', city: 'Berlin' } },
  { key: 'mcf-customer-jonas', email: 'jonas.weber@example.com', firstName: 'Jonas', lastName: 'Weber', country: 'DE', street: { streetName: 'Musterweg', streetNumber: '7', postalCode: '80801', city: 'München' } },
  { key: 'mcf-customer-emma', email: 'emma.clarke@example.com', firstName: 'Emma', lastName: 'Clarke', country: 'GB', street: { streetName: 'Sample Road', streetNumber: '31', postalCode: 'W1D 3QB', city: 'London' } },
  { key: 'mcf-customer-oliver', email: 'oliver.hughes@example.com', firstName: 'Oliver', lastName: 'Hughes', country: 'GB', street: { streetName: 'Example Close', streetNumber: '4', postalCode: 'M4 1HN', city: 'Manchester' } },
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
  name: ls('Saved items', 'Gemerkte Artikel'),
  slug: ls('saved-items-maya', 'gemerkte-artikel-maya'),
  customer: { typeId: 'customer', key: 'mcf-customer-maya' },
  lineItems: ['POD-EMBER', 'COF-HOUSE', 'MAC-POD1'].map((code) => ({ sku: productByCode(code).variants[0]?.sku as string, quantity: 1 })),
});
