/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { inviteColleague, listTeam } from '@/lib/ct/team';
import { teamInviteSchema } from '@/lib/portal/schemas';

export const GET = handle(async () => ok(await listTeam(await requireBusinessUnit())));

/** The temporary password is in this response only; the response is never cached. */
export const POST = handle(async (request: Request) => {
  const session = await requireBusinessUnit();
  const res = ok(await inviteColleague(session, await parseBody(request, teamInviteSchema)));
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
