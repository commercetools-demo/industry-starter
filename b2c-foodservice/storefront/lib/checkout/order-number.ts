import { createHash } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Crockford base32 of a byte array (no padding). */
function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

/**
 * `MC-` plus the first 10 characters of the base32 of SHA-256(cartId). Deterministic, so a retry for the same cart can never
 * create a second order (commercetools rejects a duplicate order number) and an unknown placement can be looked up (Q-K-04).
 */
export function orderNumberForCart(cartId: string): string {
  return `MC-${base32(createHash('sha256').update(cartId).digest()).slice(0, 10)}`;
}

const SUFFIXES = 'ABCDEFGH';

/** One payment keeps the base number; several (complete-per-group) get `-A`, `-B`, ... in payment order. */
export function orderNumberForPart(base: string, part: number, total: number): string {
  if (total <= 1) return base;
  return `${base}-${SUFFIXES[part] ?? String(part)}`;
}

/** The base number of any order number of this module (`MC-XXXXXXXXXX` or with a part suffix). */
export function baseOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/-[A-H]$/, '');
}

/** All numbers a purchase can have: the base and its part suffixes. */
export function numbersOfPurchase(base: string): string[] {
  return [base, ...[...SUFFIXES].map((s) => `${base}-${s}`)];
}
