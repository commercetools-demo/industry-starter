import { handle, requireCustomer } from '@/lib/api';
import { mapAddressErrors, needsConfirmation, readAddressBody, saved } from '@/lib/address-route';
import { removeAddress, updateAddress } from '@/lib/ct/addresses';

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/account/addresses/:id: change one saved address (same body and warning flow as the POST). */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { id } = await params;
    const body = await readAddressBody(request);
    if (body instanceof Response) return body;
    const pending = needsConfirmation(body);
    if (pending) return pending;
    return saved(await mapAddressErrors(() => updateAddress(customerId, id, body.input, body.makeDefault)));
  });
}

/** DELETE /api/account/addresses/:id: remove one saved address (no other address is promoted to default). */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { id } = await params;
    return saved(await mapAddressErrors(() => removeAddress(customerId, id)));
  });
}
