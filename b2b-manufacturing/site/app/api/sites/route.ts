import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { addSite, listSites } from '@/lib/ct/sites';
import { siteSchema } from '@/lib/portal/schemas';

export const GET = handle(async () => ok(await listSites(await requireBusinessUnit())));

export const POST = handle(async (request: Request) => {
  const session = await requireBusinessUnit();
  return ok(await addSite(session, await parseBody(request, siteSchema)));
});
