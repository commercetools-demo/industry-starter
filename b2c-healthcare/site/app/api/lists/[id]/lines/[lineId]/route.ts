import { handle, requireCustomer } from '@/lib/api';
import { removeLine } from '@/lib/ct/shopping-lists';
import { listNotFound } from '@/lib/list-route';
import { mapListSummary } from '@/lib/mappers/shopping-list';
import { localeOfSession } from '@/lib/order-route';

/** DELETE /api/lists/:id/lines/:lineId: removes one line (a line that is already gone is not an error). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; lineId: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id, lineId } = await ctx.params;
    const list = await removeLine(id, session.customerId, lineId);
    if (!list) throw listNotFound();
    return mapListSummary(list, localeOfSession(session));
  });
}
