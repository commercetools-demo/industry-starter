import 'server-only';
import { tableResolver } from '@/lib/addresses/resolver';
import { validateAddress } from '@/lib/addresses/validate';
import { AddressLimitError, AddressNotFoundError } from '@/lib/ct/addresses';
import type { AddressInput } from '@/lib/types';
import { AccountRefusal } from './account-api';

// Helpers of the /api/account/addresses routes: body parsing, format validation (hard block) and resolution (warning-only).

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const optional = (value: unknown): string | undefined => {
  const text = str(value).trim();
  return text === '' ? undefined : text;
};

/** The address of a request body, coerced to the AddressInput shape (unknown keys are ignored; ids never come from the client). */
export function parseAddressInput(raw: unknown): Partial<AddressInput> {
  const a = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const country = str(a.country).trim();
  return {
    firstName: str(a.firstName),
    lastName: str(a.lastName),
    streetName: str(a.streetName),
    ...(optional(a.additionalStreetInfo) ? { additionalStreetInfo: optional(a.additionalStreetInfo) as string } : {}),
    city: str(a.city),
    ...(optional(a.state) ? { state: optional(a.state) as string } : {}),
    postalCode: str(a.postalCode),
    country: country as AddressInput['country'],
    ...(optional(a.phone) ? { phone: optional(a.phone) as string } : {}),
    isService: a.isService !== false,
    isBilling: a.isBilling !== false,
  };
}

/** 400 INVALID_ADDRESS with the field errors when the format is wrong. Nothing has been stored at that point. */
export function assertValidAddress(input: Partial<AddressInput>): AddressInput {
  const fields = validateAddress(input);
  if (Object.keys(fields).length > 0) throw new AccountRefusal(400, 'INVALID_ADDRESS', 'Check the highlighted fields.', { fields });
  return input as AddressInput;
}

/**
 * Resolution is a warning: an address the resolver cannot verify is answered 409 ADDRESS_UNRESOLVED (with the fields and the nearest
 * match) and NOTHING is stored, unless the buyer confirmed ("Keep what I typed" / "Use suggested address").
 */
export async function assertResolvedOrConfirmed(input: AddressInput, confirmed: boolean): Promise<void> {
  if (confirmed) return;
  const result = await tableResolver.resolve(input);
  if (result.status === 'unresolved') {
    throw new AccountRefusal(409, 'ADDRESS_UNRESOLVED', "We couldn't verify this address.", { unresolvedFields: result.unresolvedFields, ...(result.nearestMatch ? { nearestMatch: result.nearestMatch } : {}) });
  }
}

/** Runs a customer-address call and maps its typed errors to this API's codes. */
export async function withAddressErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AddressNotFoundError) throw new AccountRefusal(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
    if (error instanceof AddressLimitError) throw new AccountRefusal(422, 'ADDRESS_LIMIT', 'The address book is full.');
    throw error;
  }
}
