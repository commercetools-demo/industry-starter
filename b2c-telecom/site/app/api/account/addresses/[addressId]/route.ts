import { accountRoute, readJsonBody } from '@/lib/api/account-api';
import { assertResolvedOrConfirmed, assertValidAddress, parseAddressInput, withAddressErrors } from '@/lib/api/address-api';
import { changeAddress, removeAddress } from '@/lib/ct/addresses';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ addressId: string }> };

// The address id in the URL is only a request to act on one of THIS customer's addresses: the module checks it against the customer's
// own book before commercetools is called (a foreign id is the same 404 as an unknown one).

export async function PATCH(request: Request, { params }: Context) {
  return accountRoute(request, { mutating: true }, async ({ session }) => {
    const { addressId } = await params;
    const body = await readJsonBody(request);
    const input = assertValidAddress(parseAddressInput(body.address ?? body));
    await assertResolvedOrConfirmed(input, body.confirmed === true);
    return { addresses: await withAddressErrors(() => changeAddress(session.customerId, addressId, input)) };
  });
}

export async function DELETE(request: Request, { params }: Context) {
  return accountRoute(request, { mutating: true }, async ({ session }) => {
    const { addressId } = await params;
    return { addresses: await withAddressErrors(() => removeAddress(session.customerId, addressId)) };
  });
}
