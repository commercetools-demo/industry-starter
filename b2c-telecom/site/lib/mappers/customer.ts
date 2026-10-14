/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

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
