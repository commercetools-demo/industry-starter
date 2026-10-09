import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { actOnQuote } from '@/lib/ct/portal-quotes';
import { renegotiateSchema } from '@/lib/portal/schemas';

/** `id` is the Quote id (the latest round of a thread, `quoteId`). */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireBusinessUnit();
  const { comment } = await parseBody(request, renegotiateSchema);
  return ok({ thread: await actOnQuote(session, (await params).id, 'renegotiate', comment) });
});
