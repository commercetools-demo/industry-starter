/** Client-safe address validation shared by the address dialog and the `/api/account/addresses` routes (S-01). */
export const ADDRESS_COUNTRIES = ['US', 'DE'] as const;
export const REQUIRED_ADDRESS_FIELDS = ['firstName', 'lastName', 'streetName', 'postalCode', 'city', 'country'] as const;
export const ADDRESS_TEXT_FIELDS = ['firstName', 'lastName', 'streetName', 'additionalStreetInfo', 'postalCode', 'city', 'country', 'phone'] as const;
export type AddressField = (typeof ADDRESS_TEXT_FIELDS)[number];
/** Message key suffix (under `account.addresses.errors`). */
export type AddressErrorKey = 'required' | 'invalidCountry' | 'invalidPostcode' | 'invalidPhone' | 'tooLong';
export type AddressErrors = Partial<Record<AddressField, AddressErrorKey>>;
export type AddressValues = Partial<Record<AddressField, unknown>>;

export const MAX_ADDRESS_FIELD_LENGTH = 100;
const POSTCODE: Record<string, RegExp> = { US: /^\d{5}(-\d{4})?$/, DE: /^\d{5}$/ };
const PHONE = /^[+\d][\d\s-]{5,}$/;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isRequired = (name: AddressField): boolean => (REQUIRED_ADDRESS_FIELDS as readonly string[]).includes(name);

/** Field -> error key; an empty object means valid. Values are trimmed before they are checked. */
export function validateAddress(input: AddressValues): AddressErrors {
  const errors: AddressErrors = {};
  for (const name of ADDRESS_TEXT_FIELDS) {
    const v = text(input[name]);
    if (v.length > MAX_ADDRESS_FIELD_LENGTH) errors[name] = 'tooLong';
    else if (v === '' && isRequired(name)) errors[name] = 'required';
  }
  const country = text(input.country);
  if (!errors.country && !(ADDRESS_COUNTRIES as readonly string[]).includes(country)) errors.country = 'invalidCountry';
  if (!errors.postalCode && !errors.country && !POSTCODE[country].test(text(input.postalCode))) errors.postalCode = 'invalidPostcode';
  const phone = text(input.phone);
  if (!errors.phone && phone !== '' && !PHONE.test(phone)) errors.phone = 'invalidPhone';
  return errors;
}

/** The trimmed values the API stores: required fields always, optional ones only when filled. */
export function normalizeAddress(input: AddressValues): Partial<Record<AddressField, string>> {
  const out: Partial<Record<AddressField, string>> = {};
  for (const name of ADDRESS_TEXT_FIELDS) {
    const v = text(input[name]);
    if (v !== '' || isRequired(name)) out[name] = v;
  }
  return out;
}
