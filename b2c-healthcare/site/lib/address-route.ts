import 'server-only';
import { ApiError } from '@/lib/api';
import { addressWarning, validateAddress, type AddressWarning } from '@/lib/address';
import { FIELDS_INVALID, readJsonObject } from '@/lib/auth-route';
import { AddressNotFoundError } from '@/lib/ct/addresses';
import { CustomerNotFoundError } from '@/lib/ct/customer-update';
import type { Address, AddressInput } from '@/lib/types';

// Shared by the Route Handlers under app/api/account/addresses.

/** Body of a create/change request: validated fields, `makeDefault`, and the patient's `confirmed` answer to a warning. */
export type AddressBody = { input: AddressInput; makeDefault: boolean; confirmed: boolean };

/** 400 with per-field codes, or the parsed body. */
export async function readAddressBody(request: Request): Promise<Response | AddressBody> {
  const body = await readJsonObject(request);
  const result = validateAddress(body);
  if (!result.ok) return Response.json({ error: FIELDS_INVALID, fields: result.problems }, { status: 400 });
  return { input: result.value, makeDefault: body.makeDefault === true, confirmed: body.confirmed === true };
}

/** Warning-only check: when the state and ZIP disagree and the patient has not confirmed, nothing is stored. */
export function needsConfirmation(body: AddressBody): Response | null {
  const warning: AddressWarning | null = addressWarning(body.input);
  if (!warning || body.confirmed) return null;
  return Response.json({ status: 'needs-confirmation', warning });
}

export const saved = (addresses: Address[]) => ({ status: 'saved' as const, addresses });

/** Unknown address id, or a customer that no longer exists, becomes the generic 404 / 401. */
export async function mapAddressErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AddressNotFoundError) throw new ApiError(404, 'Not found.');
    if (error instanceof CustomerNotFoundError) throw new ApiError(401, 'Please sign in to continue.');
    throw error;
  }
}
