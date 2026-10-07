import { accountRoute, AccountRefusal, readJsonBody } from '@/lib/api/account-api';
import { withAddressErrors } from '@/lib/api/address-api';
import { setDefault } from '@/lib/ct/addresses';

export const dynamic = 'force-dynamic';

/** `{ kind: 'service' | 'billing' }`: makes one of the customer's addresses the default for that purpose. */
export async function POST(request: Request, { params }: { params: Promise<{ addressId: string }> }) {
  return accountRoute(request, { mutating: true }, async ({ session }) => {
    const { addressId } = await params;
    const body = await readJsonBody(request);
    if (body.kind !== 'service' && body.kind !== 'billing') throw new AccountRefusal(400, 'INVALID_BODY', 'kind must be "service" or "billing".');
    const kind = body.kind;
    return { addresses: await withAddressErrors(() => setDefault(session.customerId, addressId, kind)) };
  });
}
