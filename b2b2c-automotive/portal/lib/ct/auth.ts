// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { Customer } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';

/** Thrown for wrong credentials. Unknown email and wrong password are indistinguishable by design. */
export class AuthError extends Error {
  constructor(public code: 'INVALID_CREDENTIALS') {
    super(code);
    this.name = 'AuthError';
  }
}

export interface LoginResult {
  customerId: string;
  /** Customer group ids (price and discount scoping), from the customer's group assignments and legacy group. */
  accountGroupIds: string[];
}

/** Ids of the customer's groups, without duplicates. */
export function accountGroupIdsOf(customer: Pick<Customer, 'customerGroup' | 'customerGroupAssignments'>): string[] {
  const ids = [customer.customerGroup?.id, ...(customer.customerGroupAssignments ?? []).map((a) => a.customerGroup.id)];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

const isInvalidCredentials = (error: unknown): boolean => {
  const e = error as { statusCode?: number; body?: { errors?: { code?: string }[] } } | null;
  return e?.statusCode === 400 && (e.body?.errors ?? []).some((x) => x.code === 'InvalidCredentials');
};

/**
 * Signs in through the login endpoint (`apiRoot.login().post`, never `customers().login()`).
 * Throws `AuthError('INVALID_CREDENTIALS')` for wrong credentials; any other failure propagates. The password is
 * used for this one call only: never logged, stored in the session or returned.
 */
export async function loginCustomer(email: string, password: string): Promise<LoginResult> {
  try {
    const { body } = await apiRoot.login().post({ body: { email, password, updateProductData: false } }).execute();
    return { customerId: body.customer.id, accountGroupIds: accountGroupIdsOf(body.customer) };
  } catch (error) {
    if (isInvalidCredentials(error)) throw new AuthError('INVALID_CREDENTIALS');
    throw error;
  }
}
