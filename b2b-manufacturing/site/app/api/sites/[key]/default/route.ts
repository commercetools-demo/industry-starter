import { handle, ok, requireBusinessUnit } from '@/lib/api';
import { setDefaultSite } from '@/lib/ct/sites';

export const POST = handle(async (_request: Request, { params }: { params: Promise<{ key: string }> }) => {
  const session = await requireBusinessUnit();
  return ok(await setDefaultSite(session, (await params).key));
});
