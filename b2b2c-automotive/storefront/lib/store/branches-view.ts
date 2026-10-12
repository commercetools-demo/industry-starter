// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Builds the `GET /api/store-context/branches` payload from a store and a session. Pure (no server-only): `now` is injected.
import { getBranchScope } from '@/lib/store/branch-scope';
import { getHoursState, getPickupOption } from '@/lib/store/pickup';
import type { BranchesResponse, Session, ShellContext } from '@/lib/types';

export function buildBranchesResponse(ctx: ShellContext, session: Pick<Session, 'branchKey'>, now: Date): BranchesResponse {
  const scope = getBranchScope(session, ctx.branches, ctx.retailChannelId);
  const tz = ctx.settings.timezone;
  return {
    single: ctx.branches.length <= 1,
    selectedKey: scope.branchKey ?? '',
    chosen: Boolean(session.branchKey) && ctx.branches.some((b) => b.key === session.branchKey),
    branches: ctx.branches.map((b) => ({ ...b, hoursState: getHoursState(b, now, tz), pickup: getPickupOption(b, now, tz) })),
  };
}
