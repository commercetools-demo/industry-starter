import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { changeRole, removeColleague } from '@/lib/ct/team';
import { teamRoleSchema } from '@/lib/portal/schemas';

type Ctx = { params: Promise<{ customerId: string }> };

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireBusinessUnit();
  const { roleKey } = await parseBody(request, teamRoleSchema);
  return ok(await changeRole(session, (await params).customerId, roleKey));
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireBusinessUnit();
  return ok(await removeColleague(session, (await params).customerId));
});
