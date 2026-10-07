import { accountRoute, readJsonBody } from '@/lib/api/account-api';
import { assertResolvedOrConfirmed, assertValidAddress, parseAddressInput, withAddressErrors } from '@/lib/api/address-api';
import { addAddress, getAddresses } from '@/lib/ct/addresses';

export const dynamic = 'force-dynamic';

/** The signed-in customer's address book. The customer is the session's; there is no id in the URL. */
export async function GET(request: Request) {
  return accountRoute(request, {}, async ({ session }) => ({ addresses: await getAddresses(session.customerId) }));
}

/**
 * Adds an address. Format errors are 400 INVALID_ADDRESS; an address the resolver cannot verify is 409 ADDRESS_UNRESOLVED and nothing
 * is stored until the buyer sends the same address with `confirmed: true`.
 */
export async function POST(request: Request) {
  return accountRoute(request, { mutating: true, status: 201 }, async ({ session }) => {
    const body = await readJsonBody(request);
    const input = assertValidAddress(parseAddressInput(body.address));
    await assertResolvedOrConfirmed(input, body.confirmed === true);
    const addresses = await withAddressErrors(() => addAddress(session.customerId, input, { service: body.makeDefaultService === true, billing: body.makeDefaultBilling === true }));
    return { addresses };
  });
}
