import { accountRoute, readJsonBody } from '@/lib/api/account-api';
import { parseAddressInput } from '@/lib/api/address-api';
import { tableResolver } from '@/lib/addresses/resolver';
import { validateAddress } from '@/lib/addresses/validate';
import type { AddressInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Checks an address without storing anything: the format errors per field and, when the format is fine, the resolver's verdict. */
export async function POST(request: Request) {
  return accountRoute(request, { mutating: true }, async () => {
    const body = await readJsonBody(request);
    const input = parseAddressInput(body.address);
    const fields = validateAddress(input);
    if (Object.keys(fields).length > 0) return { fields };
    return { fields, resolve: await tableResolver.resolve(input as AddressInput) };
  });
}
