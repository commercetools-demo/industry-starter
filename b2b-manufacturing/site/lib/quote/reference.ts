import { randomInt } from 'node:crypto';

/** Crockford base 32 without I, L, O, U: easy to read out over the phone. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** `MQ-` plus six base-32 characters. */
export function makeReference(): string {
  let out = 'MQ-';
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
