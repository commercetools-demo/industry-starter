// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Development and test only: a release build must not contain this file (scripts/check-no-health-in-release.mjs).
import { apiRoot } from '@/lib/ct/client';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    const { body } = await apiRoot.get().execute();
    return Response.json({ ok: true, projectKey: body.key });
  } catch {
    // No message from the SDK: it can name scopes, hosts or ids.
    return Response.json({ ok: false, error: 'commercetools unreachable or credentials invalid' }, { status: 503 });
  }
}
