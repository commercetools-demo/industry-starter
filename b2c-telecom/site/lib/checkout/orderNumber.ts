import { randomInt } from 'node:crypto';
import { ORDER_NUMBER_ALPHABET, ORDER_NUMBER_LENGTH, ORDER_NUMBER_PATTERN, ORDER_NUMBER_PREFIX } from '@/lib/config/checkout';

/** `MLV-` + 8 Crockford base32 characters. Used as the commercetools `futureOrderNumber`; unguessable, so the confirmation URL is a capability link. */
export function generateOrderNumber(random: (max: number) => number = (max) => randomInt(max)): string {
  let out = '';
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i += 1) out += ORDER_NUMBER_ALPHABET[random(ORDER_NUMBER_ALPHABET.length)];
  return `${ORDER_NUMBER_PREFIX}-${out}`;
}

export const isOrderNumber = (value: string): boolean => ORDER_NUMBER_PATTERN.test(value);
