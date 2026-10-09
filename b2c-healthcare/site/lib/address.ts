import type { Address, AddressInput } from '@/lib/types';

// Address rules shared by the form and the Route Handlers (format validation only: no provider).

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
export const NAME_MAX = 100;
export const LINE_MAX = 200;

export type AddressField = 'firstName' | 'lastName' | 'street' | 'street2' | 'city' | 'state' | 'zip' | 'phone';
export type AddressProblem = 'required' | 'invalid';
export type AddressProblems = Partial<Record<AddressField, AddressProblem>>;

/** Form order: the first field with a problem receives focus. */
export const ADDRESS_FIELD_ORDER: readonly AddressField[] = ['firstName', 'lastName', 'street', 'street2', 'city', 'state', 'zip', 'phone'];

/** US phone to `+1XXXXXXXXXX`; null when the digits do not fit (10 digits, or 11 with a leading 1). */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed) || trimmed.lastIndexOf('+') > 0) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 && !trimmed.startsWith('+')) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export type AddressValidation = { ok: true; value: AddressInput } | { ok: false; problems: AddressProblems };

/** Validates untrusted input (a request body or the form values). Format only; the same function runs on both sides. */
export function validateAddress(input: unknown): AddressValidation {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const problems: AddressProblems = {};
  const firstName = text(raw.firstName);
  const lastName = text(raw.lastName);
  const street = text(raw.street);
  const street2 = text(raw.street2);
  const city = text(raw.city);
  const state = text(raw.state).toUpperCase();
  const zip = text(raw.zip);
  const phoneRaw = text(raw.phone);

  if (!firstName) problems.firstName = 'required';
  else if (firstName.length > NAME_MAX) problems.firstName = 'invalid';
  if (!lastName) problems.lastName = 'required';
  else if (lastName.length > NAME_MAX) problems.lastName = 'invalid';
  if (!street) problems.street = 'required';
  else if (street.length > LINE_MAX) problems.street = 'invalid';
  if (street2.length > LINE_MAX) problems.street2 = 'invalid';
  if (!city) problems.city = 'required';
  else if (city.length > NAME_MAX) problems.city = 'invalid';
  if (!state) problems.state = 'required';
  else if (!(US_STATES as readonly string[]).includes(state)) problems.state = 'invalid';
  if (!zip) problems.zip = 'required';
  else if (!ZIP_PATTERN.test(zip)) problems.zip = 'invalid';
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!phoneRaw) problems.phone = 'required';
  else if (!phone) problems.phone = 'invalid';

  if (Object.keys(problems).length > 0 || !phone) return { ok: false, problems };
  return { ok: true, value: { firstName, lastName, street, street2, city, state, zip, phone } };
}

// First three ZIP digits per state (inclusive ranges, USPS allocation). Small on purpose: a mismatch only
// raises a warning the patient can override; prefixes not listed (military, territories) never warn.
const ZIP3_RANGES: ReadonlyArray<readonly [state: string, from: number, to: number]> = [
  ['MA', 10, 27], ['RI', 28, 29], ['NH', 30, 38], ['ME', 39, 49], ['VT', 50, 54], ['VT', 56, 59], ['CT', 60, 69],
  ['NJ', 70, 89], ['NY', 100, 149], ['PA', 150, 196], ['DE', 197, 199], ['DC', 200, 200], ['VA', 201, 201],
  ['DC', 202, 205], ['MD', 206, 219], ['VA', 220, 246], ['WV', 247, 268], ['NC', 270, 289], ['SC', 290, 299],
  ['GA', 300, 319], ['FL', 320, 349], ['AL', 350, 369], ['TN', 370, 385], ['MS', 386, 397], ['GA', 398, 399],
  ['KY', 400, 427], ['OH', 430, 458], ['IN', 460, 479], ['MI', 480, 499], ['IA', 500, 528], ['WI', 530, 549],
  ['MN', 550, 551], ['MN', 553, 567], ['DC', 569, 569], ['SD', 570, 577], ['ND', 580, 588], ['MT', 590, 599],
  ['IL', 600, 629], ['MO', 630, 658], ['KS', 660, 679], ['NE', 680, 693], ['LA', 700, 714], ['AR', 716, 729],
  ['OK', 730, 749], ['TX', 750, 799], ['CO', 800, 816], ['WY', 820, 831], ['ID', 832, 838], ['UT', 840, 847],
  ['AZ', 850, 865], ['NM', 870, 884], ['TX', 885, 885], ['NV', 889, 898], ['CA', 900, 961], ['HI', 967, 968],
  ['OR', 970, 979], ['WA', 980, 994], ['AK', 995, 999],
];

/** The state a ZIP's first three digits belong to, or null when unknown. */
export function stateForZip(zip: string): string | null {
  if (!ZIP_PATTERN.test(zip)) return null;
  const prefix = Number(zip.slice(0, 3));
  return ZIP3_RANGES.find(([, from, to]) => prefix >= from && prefix <= to)?.[0] ?? null;
}

/** Fields that could not be reconciled and the nearest match (the state the ZIP belongs to). */
export interface AddressWarning {
  fields: Array<'state' | 'zip'>;
  nearestState: string;
}

/** Warning (never a block) when a format-valid state does not match the ZIP prefix table. */
export function addressWarning(input: Pick<AddressInput, 'state' | 'zip'>): AddressWarning | null {
  const expected = stateForZip(input.zip);
  if (!expected || expected === input.state) return null;
  return { fields: ['state', 'zip'], nearestState: expected };
}

/** The address checkout preselects: the default shipping address, or null (the buyer is asked to choose). */
export function defaultAddress(addresses: readonly Address[]): Address | null {
  return addresses.find((address) => address.isDefault) ?? null;
}

/** Blank form values for a new address; the name defaults to the account's name (checkout and the address book). */
export function newAddressDefaults(account?: { firstName?: string; lastName?: string } | null): AddressInput {
  return { firstName: account?.firstName ?? '', lastName: account?.lastName ?? '', street: '', street2: '', city: '', state: '', zip: '', phone: '' };
}

/** Display name of an address, "First Last". */
export function addressName(address: Pick<Address, 'firstName' | 'lastName'>): string {
  return `${address.firstName} ${address.lastName}`.trim();
}
