// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { rescopeCartToBranch } from '@/lib/ct/cart';
import { getShellContext } from '@/lib/ct/shell';
import { getLocale, getSession, updateSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';

const body = z.object({ branchKey: z.string().min(2).max(256) });

/** Stores the chosen branch in the session; with a cart, asks the cart layer to re-scope and re-price it (workstream N). */
export const POST = handle(async (request: Request) => {
  const { branchKey } = await parseJson(request, body);
  const session = await getSession();
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const ctx = await getShellContext(session.storeKey, (await getLocale()).locale);
  if (!ctx) throw new ApiError(404, 'Not found');
  // A branch of another store (or an unknown key) is a bad request; nothing is written.
  if (!ctx.branches.some((b) => b.key === branchKey)) throw new ApiError(400, 'Unknown branch');

  await updateSession((s) => ({ ...s, branchKey }));
  let cartRepriced = false;
  if (session.cartId) {
    try {
      cartRepriced = await rescopeCartToBranch(session.storeKey, session.cartId, getBranchScope({ branchKey }, ctx.branches, ctx.retailChannelId));
    } catch {
      console.error('[api] cart re-scope after a branch change failed');
    }
  }
  return Response.json({ ok: true, cartRepriced });
});
