import { addressFailure, addressesJson, parseAddressBody } from '@/lib/api/address-api';
import { unauthenticated } from '@/lib/api/private-json';
import { readJson } from '@/lib/cart-api';
import { addAddress, getAddresses } from '@/lib/ct/addresses';
import { getSession } from '@/lib/session';

/** The signed-in customer's address book: `{ addresses }`. */
export async function GET() {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  try {
    return addressesJson(await getAddresses(customerId));
  } catch (e) {
    return addressFailure(e);
  }
}

/** Adds an address (the first one becomes the default shipping address). 400 `INVALID_ADDRESS` with `fields`; answers the full list. */
export async function POST(request: Request) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const parsed = parseAddressBody(await readJson(request));
  if ('response' in parsed) return parsed.response;
  try {
    return addressesJson(await addAddress(customerId, parsed.address), { status: 201 });
  } catch (e) {
    return addressFailure(e);
  }
}
