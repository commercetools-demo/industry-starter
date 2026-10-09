import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { actOnQuote } from '@/lib/ct/portal-quotes';

/** `id` is the Quote id (the latest round of a thread, `quoteId`). */
export const POST = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireBusinessUnit();
  return ok({ thread: await actOnQuote(session, (await params).id, 'accept') });
});
