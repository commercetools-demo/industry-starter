import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { removeSite, updateSite } from '@/lib/ct/sites';
import { siteSchema } from '@/lib/portal/schemas';

type Ctx = { params: Promise<{ key: string }> };

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireBusinessUnit();
  return ok(await updateSite(session, (await params).key, await parseBody(request, siteSchema)));
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireBusinessUnit();
  return ok(await removeSite(session, (await params).key));
});
