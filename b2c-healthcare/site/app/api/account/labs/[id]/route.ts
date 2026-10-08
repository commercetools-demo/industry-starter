import { ApiError, handle, requireCustomer } from '@/lib/api';
import { getLabDetail } from '@/lib/ct/account-labs';

/** GET /api/account/labs/:id: one of the signed-in patient's tests. An unknown and a foreign id answer the same 404. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const { id } = await ctx.params;
    const lab = await getLabDetail(customerId, id);
    if (!lab) throw new ApiError(404, 'Not found.');
    return lab;
  });
}
