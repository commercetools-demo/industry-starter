import 'server-only';
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// "Anna T." from an address: first name and the initial of the last name, never more personal data than that.
export function shortName(address: { firstName?: string; lastName?: string } | undefined): string {
  const first = address?.firstName?.trim() ?? '';
  const initial = address?.lastName?.trim().charAt(0).toUpperCase() ?? '';
  return [first, initial ? `${initial}.` : ''].filter(Boolean).join(' ');
}

/** Orders placed as a test (`malva-checkout.isTest`) never count anywhere on the dashboard; a missing custom type is not a test. */
export const EXCLUDE_TEST_ORDERS = 'not(custom(fields(isTest=true)))';

export const isTestOrder = (order: { custom?: { fields?: Record<string, unknown> } }): boolean => order.custom?.fields?.isTest === true;
