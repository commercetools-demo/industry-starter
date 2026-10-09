import { handle, requireCustomer } from '@/lib/api';
import { mapAddressErrors, needsConfirmation, readAddressBody, saved } from '@/lib/address-route';
import { addAddress, listAddresses } from '@/lib/ct/addresses';

/** GET /api/account/addresses: the signed-in patient's saved addresses (default first). */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    return { addresses: await mapAddressErrors(() => listAddresses(customerId)) };
  });
}

/**
 * POST /api/account/addresses { ...fields, makeDefault?, confirmed? }. A format-valid address whose state and ZIP
 * disagree answers `{ status: 'needs-confirmation', warning }` and stores nothing until the patient confirms.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const body = await readAddressBody(request);
    if (body instanceof Response) return body;
    const pending = needsConfirmation(body);
    if (pending) return pending;
    return saved(await mapAddressErrors(() => addAddress(customerId, body.input, body.makeDefault)));
  });
}
