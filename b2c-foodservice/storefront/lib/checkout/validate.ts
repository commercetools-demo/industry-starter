/**
 * Checkout validators (workstream K, 3.6). Pure, shared by the Review form and every handler. Contact, address and card
 * validation belong to the hosted Checkout; only what we collect is checked here. Each returns `null` or an error code,
 * and each code has a message `checkout.errors.<code>`.
 */
export type CheckoutErrorCode = 'pickup_name_required' | 'pickup_name_invalid' | 'person_invalid' | 'code_malformed';

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;
const CODE_PATTERN = /^[A-Z0-9_-]{2,32}$/;

export type PickupPerson = 'me' | 'other';

/** `required`: the bag has a collect group. An empty name is fine when nothing is collected. */
export function validatePickupName(value: unknown, required: boolean): CheckoutErrorCode | null {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '') return required ? 'pickup_name_required' : null;
  if (name.length < 2 || name.length > 80 || !NAME_PATTERN.test(name)) return 'pickup_name_invalid';
  return null;
}

export function validatePerson(value: unknown): CheckoutErrorCode | null {
  return value === 'me' || value === 'other' ? null : 'person_invalid';
}

/** Trim and upper-case a code the shopper typed. */
export function normaliseCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validateCode(value: unknown): CheckoutErrorCode | null {
  return typeof value === 'string' && CODE_PATTERN.test(normaliseCode(value)) ? null : 'code_malformed';
}

const CURRENCY_OF: Record<string, string> = { US: 'USD', CA: 'CAD' };

/** The only country and currency pairs of this shop (D-030). */
export function currencyMatchesCountry(country: string, currency: string): boolean {
  return CURRENCY_OF[country] === currency;
}

export interface PickupInput {
  person: unknown;
  pickupName: unknown;
}

/** All pickup fields at once: `{ field: code }`, empty when valid. */
export function validatePickup(input: PickupInput, collectInBag: boolean): Record<string, CheckoutErrorCode> {
  if (!collectInBag) return {};
  const fields: Record<string, CheckoutErrorCode> = {};
  const person = validatePerson(input.person);
  if (person) fields.person = person;
  const name = validatePickupName(input.pickupName, true);
  if (name) fields.pickupName = name;
  return fields;
}
