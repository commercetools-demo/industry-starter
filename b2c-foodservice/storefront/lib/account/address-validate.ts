import { NAME_PATTERN, SHOP_COUNTRIES } from '@/lib/checkout/validate';
import type { AddressInput } from '@/lib/types';

/** The two markets (D-030), shared with the checkout validators. */
export const ADDRESS_COUNTRIES = SHOP_COUNTRIES;

export const US_STATES: readonly string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const POSTAL: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
};
export const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const MAX = { name: 60, street: 100, city: 60, label: 40 };

export type AddressFieldError = 'required' | 'too_long' | 'invalid' | 'unsupported';
export type AddressValidation =
  | { ok: true; address: AddressInput }
  | { ok: false; fields: Record<string, AddressFieldError> };

const text = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/**
 * Format checks for an address book entry (workstream L; names and countries use the checkout validators of `lib/checkout/validate.ts`, Q-L-17).
 * Returns the normalised address (trimmed, state and Canadian postal code upper-cased) or field error codes the form
 * shows beside the fields. Phone is optional. The state is required in the US only.
 */
export function validateAddress(raw: unknown): AddressValidation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fields: Record<string, AddressFieldError> = {};
  const required = (key: string, max: number): string => {
    const v = text(r[key]);
    if (!v) fields[key] = 'required';
    else if (v.length > max) fields[key] = 'too_long';
    return v;
  };
  const optional = (key: string, max: number): string | undefined => {
    const v = text(r[key]);
    if (!v) return undefined;
    if (v.length > max) fields[key] = 'too_long';
    return v;
  };

  const firstName = required('firstName', MAX.name);
  const lastName = required('lastName', MAX.name);
  for (const [key, v] of [['firstName', firstName], ['lastName', lastName]] as const) {
    if (v && !fields[key] && !NAME_PATTERN.test(v)) fields[key] = 'invalid';
  }
  const streetName = required('streetName', MAX.street);
  const additionalStreetInfo = optional('additionalStreetInfo', MAX.street);
  const city = required('city', MAX.city);
  const label = optional('label', MAX.label);

  const country = text(r.country).toUpperCase();
  if (!country) fields.country = 'required';
  else if (!(ADDRESS_COUNTRIES as readonly string[]).includes(country)) fields.country = 'unsupported';

  let postalCode = text(r.postalCode);
  if (!postalCode) fields.postalCode = 'required';
  else if (POSTAL[country] && !POSTAL[country].test(postalCode)) fields.postalCode = 'invalid';
  if (country === 'CA') postalCode = postalCode.toUpperCase();

  let state: string | undefined;
  if (country === 'US') {
    const s = text(r.state).toUpperCase();
    if (!s) fields.state = 'required';
    else if (!US_STATES.includes(s)) fields.state = 'invalid';
    else state = s;
  } else {
    // Canada has no state field in the form; a province saved earlier is kept as it is.
    state = optional('state', 3)?.toUpperCase();
  }

  const phone = optional('phone', 20);
  if (phone && !PHONE.test(phone)) fields.phone = 'invalid';

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    address: {
      firstName, lastName, streetName, city, postalCode, country,
      ...(additionalStreetInfo ? { additionalStreetInfo } : {}),
      ...(label ? { label } : {}),
      ...(state ? { state } : {}),
      ...(phone ? { phone } : {}),
    },
  };
}
