// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// GET /api/health: development and test only. Confirms the frontend and seller-admin credentials work and says whether the
// provisioning client is configured. It must not ship: `check-no-health-in-release` fails a release build while this file exists.
import { errorResponse } from '@/lib/api';
import { validatePortalEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return errorResponse(404, 'Not found');
  const unreachable = (partial: Record<string, unknown> = {}) =>
    Response.json({ ok: false, ...partial, error: 'commercetools unreachable or credentials invalid' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const { provisioning } = validatePortalEnv(process.env);
    const { apiRoot } = await import('@/lib/ct/client');
    const { probeAdmin } = await import('@/lib/ct/seller/health');
    const [frontend, admin] = await Promise.all([
      apiRoot
        .get()
        .execute()
        .then((r) => r.body.key)
        .catch(() => null),
      probeAdmin(),
    ]);
    const state = { frontend: frontend !== null, admin, provisioning: provisioning ? 'configured' : 'missing' };
    if (frontend === null || !admin) return unreachable(state);
    return Response.json({ ok: true, projectKey: frontend, ...state }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return unreachable();
  }
}
