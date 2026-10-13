// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Privacy of the reseller's shoppers (V-02): lists always show the e-mail masked; the detail shows it in full to an Admin only.
import type { LogicalRole } from '@/lib/types';

/** `anna.beispiel@example.de` becomes `a***@e***.de`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot > 0 ? domain.slice(dot) : '';
  const label = dot > 0 ? domain.slice(0, dot) : domain;
  return `${local[0]}***@${label[0] ?? ''}***${tld}`;
}

export interface CustomerFacts {
  email: string;
  mobile?: string;
  addresses?: unknown[];
  [key: string]: unknown;
}

/** An Admin sees the record unmasked; every other role gets a masked e-mail and no phone or address. */
export function maskCustomer<T extends CustomerFacts>(customer: T, role: LogicalRole | LogicalRole[]): T {
  const roles = Array.isArray(role) ? role : [role];
  if (roles.includes('admin')) return customer;
  const { mobile: _mobile, addresses: _addresses, ...rest } = customer;
  void _mobile;
  void _addresses;
  return { ...rest, email: maskEmail(customer.email) } as T;
}
