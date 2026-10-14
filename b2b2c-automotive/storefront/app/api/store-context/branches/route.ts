// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { isAppLocale } from '@/i18n/config';
import { ApiError, handle } from '@/lib/api';
import { getShellContext } from '@/lib/ct/shell';
import { getLocale, getSession } from '@/lib/session';
import { buildBranchesResponse } from '@/lib/store/branches-view';

/** The branches of the session's store with hours state and pickup option; `?locale=` picks the language of the names. */
export const GET = handle(async (request: Request) => {
  const session = await getSession();
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const asked = new URL(request.url).searchParams.get('locale');
  const locale = isAppLocale(asked) ? asked : (await getLocale()).locale;
  const ctx = await getShellContext(session.storeKey, locale);
  if (!ctx) throw new ApiError(404, 'Not found');
  return Response.json(buildBranchesResponse(ctx, session, new Date()), { headers: { 'Cache-Control': 'private, no-store' } });
});
