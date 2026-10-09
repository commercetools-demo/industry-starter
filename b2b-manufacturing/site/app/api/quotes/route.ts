import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { listThreads } from '@/lib/ct/portal-quotes';

export const GET = handle(async () => {
  const session = await requireBusinessUnit();
  return ok({ threads: await listThreads(session) });
});
