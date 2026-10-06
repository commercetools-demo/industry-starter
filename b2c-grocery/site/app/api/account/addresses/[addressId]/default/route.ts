import { addressFailure, addressesJson } from '@/lib/api/address-api';
import { unauthenticated } from '@/lib/api/private-json';
import { makeDefault } from '@/lib/ct/addresses';
import { getSession } from '@/lib/session';

/** Makes the address the default shipping and billing address; answers the full list. */
export async function POST(_request: Request, { params }: { params: Promise<{ addressId: string }> }) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { addressId } = await params;
  try {
    return addressesJson(await makeDefault(customerId, addressId));
  } catch (e) {
    return addressFailure(e);
  }
}
