import { addressFailure, addressesJson, parseAddressBody } from '@/lib/api/address-api';
import { unauthenticated } from '@/lib/api/private-json';
import { readJson } from '@/lib/cart-api';
import { changeAddress, removeAddress } from '@/lib/ct/addresses';
import { getSession } from '@/lib/session';

type Params = { params: Promise<{ addressId: string }> };

/** Replaces the fields of one of the customer's own addresses; the id is looked up in their book only. */
export async function PATCH(request: Request, { params }: Params) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { addressId } = await params;
  const parsed = parseAddressBody(await readJson(request));
  if ('response' in parsed) return parsed.response;
  try {
    return addressesJson(await changeAddress(customerId, addressId, parsed.address));
  } catch (e) {
    return addressFailure(e);
  }
}

/** Deletes one of the customer's own addresses; answers the remaining list. */
export async function DELETE(_request: Request, { params }: Params) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { addressId } = await params;
  try {
    return addressesJson(await removeAddress(customerId, addressId));
  } catch (e) {
    return addressFailure(e);
  }
}
