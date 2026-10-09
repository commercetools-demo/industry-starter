import { handle, parseBody } from '@/lib/api';
import { removeLine, updateLine } from '@/lib/ct/quote-list';
import { withList } from '@/lib/quote/list-api';
import { patchLineSchema } from '@/lib/quote/schemas';

type Context = { params: Promise<{ id: string }> };

/** Change a line's frequency and/or note: `{ frequency?: string | null, note?: string | null }`. */
export const PATCH = handle(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const body = await parseBody(request, patchLineSchema);
  const patch: { frequency?: unknown; note?: unknown } = {};
  if (body.frequency !== undefined) patch.frequency = body.frequency ?? '';
  if (body.note !== undefined) patch.note = body.note ?? '';
  return withList(request, (session, services) => updateLine(session, id, patch, services));
});

export const DELETE = handle(async (request: Request, { params }: Context) => {
  const { id } = await params;
  return withList(request, (session, services) => removeLine(session, id, services));
});
