import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { getThread } from '@/lib/ct/portal-quotes';

/** `id` is the quote request id (the thread). */
export const GET = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireBusinessUnit();
  return ok({ thread: await getThread(session, (await params).id) });
});
