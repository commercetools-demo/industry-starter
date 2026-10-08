import { handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { getListView } from '@/lib/ct/list-view';
import { deleteList, getOwnList, renameList } from '@/lib/ct/shopping-lists';
import { listLimitError, listNotFound } from '@/lib/list-route';
import { mapListSummary } from '@/lib/mappers/shopping-list';
import { localeOfSession } from '@/lib/order-route';
import { rxContextOf } from '@/lib/rx-route';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/lists/:id: one list with each line's catalog price at view time. A foreign or unknown id answers the same 404. */
export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const list = await getOwnList(id, session.customerId);
    if (!list) throw listNotFound();
    return getListView(list, rxContextOf(session));
  });
}

/** PATCH /api/lists/:id { name }: renames the list. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const body = await readJsonObject(request);
    const locale = localeOfSession(session);
    try {
      const list = await renameList(id, session.customerId, typeof body.name === 'string' ? body.name : '', locale);
      if (!list) throw listNotFound();
      return mapListSummary(list, locale);
    } catch (error) {
      return listLimitError(error);
    }
  });
}

/** DELETE /api/lists/:id. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    if (!(await deleteList(id, session.customerId))) throw listNotFound();
    return { deleted: true };
  });
}
