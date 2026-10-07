import { ADDRESS_FIELD_MAX } from '@/lib/config/addresses';
import type { AddressField, AddressFieldError, AddressInput } from '@/lib/types';
import { US_STATES } from './zip-table';

const US_ZIP = /^\d{5}(-\d{4})?$/;
const DE_ZIP = /^\d{5}$/;
const PHONE = /^[+\d][\d\s().-]{5,19}$/;
const REQUIRED: readonly AddressField[] = ['firstName', 'lastName', 'streetName', 'city', 'postalCode', 'country'];

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Format validation (a hard block, never calls a provider, D-059). Returns one error code per field; an empty object = valid. The ZIP
 * keeps its `-` (ZIP+4 is valid for the US).
 */
export function validateAddress(a: Partial<AddressInput>): Partial<Record<AddressField, AddressFieldError>> {
  const errors: Partial<Record<AddressField, AddressFieldError>> = {};
  const country = text(a.country);
  for (const field of REQUIRED) if (text(a[field]) === '') errors[field] = 'required';
  if (country !== '' && country !== 'US' && country !== 'DE') errors.country = 'invalidCountry';

  const state = text(a.state);
  if (country === 'US') {
    if (state === '') errors.state = 'required';
    else if (!US_STATES.includes(state)) errors.state = 'invalidState';
  }

  const postal = text(a.postalCode);
  if (postal !== '' && !errors.country) {
    const pattern = country === 'US' ? US_ZIP : DE_ZIP;
    if (!pattern.test(postal)) errors.postalCode = 'invalidPostalCode';
  }

  const phone = text(a.phone);
  if (phone !== '' && !PHONE.test(phone)) errors.phone = 'invalidPhone';

  for (const field of ['firstName', 'lastName', 'streetName', 'additionalStreetInfo', 'city', 'state', 'postalCode', 'phone'] as const) {
    const value = a[field];
    if (typeof value === 'string' && value.trim().length > ADDRESS_FIELD_MAX && !errors[field as AddressField]) {
      errors[field as AddressField] = 'tooLong';
    }
  }
  return errors;
}
