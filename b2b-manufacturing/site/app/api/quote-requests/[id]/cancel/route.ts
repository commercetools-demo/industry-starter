import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { cancelRequest } from '@/lib/ct/portal-quotes';

export const POST = handle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireBusinessUnit();
  return ok({ thread: await cancelRequest(session, (await params).id) });
});
