/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Text of a failed returns call: a known machine code has its own message, a 403 the permission message, anything else the generic one.
export function returnsErrorKey(result: { status: number; code?: string }, known: (key: string) => boolean): string {
  if (result.status === 403) return 'errors.forbidden';
  if (result.code && known(`errors.${result.code}`)) return `errors.${result.code}`;
  return 'errors.generic';
}
