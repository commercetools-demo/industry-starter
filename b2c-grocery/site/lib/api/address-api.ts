import 'server-only';
import type { NextResponse } from 'next/server';
import { AddressCustomerNotFoundError, AddressNotFoundError } from '@/lib/ct/addresses';
import { normalizeAddress, validateAddress } from '@/lib/address-validation';
import type { Address, SavedAddress } from '@/lib/types';
import { privateJson } from './private-json';

/** Every address route answers with the whole book so the client cache takes the server's truth. */
export const addressesJson = (addresses: SavedAddress[], init?: ResponseInit): NextResponse => privateJson({ addresses }, init);

/** Validates a request body with the shared rules. 400 `INVALID_ADDRESS` carries `fields: { <field>: <error key> }`. */
export function parseAddressBody(body: Record<string, unknown>): { address: Address } | { response: NextResponse } {
  const fields = validateAddress(body);
  if (Object.keys(fields).length > 0) return { response: privateJson({ error: 'INVALID_ADDRESS', fields }, { status: 400 }) };
  const v = normalizeAddress(body);
  return {
    address: {
      firstName: v.firstName,
      lastName: v.lastName,
      streetName: v.streetName,
      postalCode: v.postalCode,
      city: v.city,
      country: v.country ?? '',
      ...(v.additionalStreetInfo ? { additionalStreetInfo: v.additionalStreetInfo } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
    },
  };
}

/** Maps a failed address call: unknown address 404, vanished customer 404, a second version conflict 409, the rest 500. Never logs the address. */
export function addressFailure(e: unknown): NextResponse {
  if (e instanceof AddressNotFoundError) return privateJson({ error: 'ADDRESS_NOT_FOUND' }, { status: 404 });
  if (e instanceof AddressCustomerNotFoundError) return privateJson({ error: 'CUSTOMER_NOT_FOUND' }, { status: 404 });
  const status = typeof e === 'object' && e !== null ? (e as { statusCode?: unknown }).statusCode : undefined;
  console.error('Address request failed', e instanceof Error ? e.message : e);
  return privateJson({ error: 'ADDRESS_ERROR' }, { status: status === 409 ? 409 : 500 });
}
