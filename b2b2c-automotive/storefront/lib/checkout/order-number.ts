// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Order numbers (O D6). Checkout takes the number in the session metadata (`futureOrderNumber`, confirmed in the Checkout docs), so the
// happy path needs no update after the order exists. The number is derived from the CART id (known before the order) and is stable:
// a second session for the same cart gets the same number, and only one order can ever come from a cart.
import { createHash } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORDER_NUMBER_FORMAT = /^MA-[0-9A-HJKMNP-TV-Z]{8}$/;

/** `MA-` plus 8 Crockford base32 characters (40 bits) of `sha256("<id>:<salt>")`. */
export function deriveOrderNumber(id: string, salt = 0): string {
  const digest = createHash('sha256').update(`${id}:${salt}`).digest();
  let out = '';
  let bits = 0;
  let acc = 0;
  for (const byte of digest) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < 8) {
      out += CROCKFORD[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
    if (out.length === 8) break;
  }
  return `MA-${out}`;
}
