// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// commercetools customer to the account model (workstream N-08). Never carries the password, tokens or custom fields besides `mobile`.
import type { Customer } from '@commercetools/platform-sdk';
import type { AccountCustomer } from '@/lib/types';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function mapCustomer(customer: Customer): AccountCustomer {
  return {
    id: customer.id,
    email: customer.email,
    firstName: text(customer.firstName),
    lastName: text(customer.lastName),
    mobile: text(customer.custom?.fields?.mobile),
    addresses: (customer.addresses ?? []).map((a) => ({
      id: a.id ?? '',
      firstName: text(a.firstName),
      lastName: text(a.lastName),
      streetName: text(a.streetName),
      streetNumber: text(a.streetNumber),
      postalCode: text(a.postalCode),
      city: text(a.city),
      country: a.country,
    })),
    defaultShippingAddressId: customer.defaultShippingAddressId ?? null,
    defaultBillingAddressId: customer.defaultBillingAddressId ?? null,
  };
}
