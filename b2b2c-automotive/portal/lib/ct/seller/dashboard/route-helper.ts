// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// One Route Handler factory for every dashboard endpoint (S-05): session (401), business unit (400), `authorizeStore` (403) BEFORE
// any commercetools call, store key from the session only (a storeKey in the query or body is never read), then the read. An
// unexpected upstream failure is 502 `{ error: 'unavailable' }`: no stack, no commercetools message.
import 'server-only';
import { ApiError, handle, requireBusinessUnit } from '@/lib/api';
import { authorizeStore } from '@/lib/authz/authorize-store';
import { can, type PortalAction } from '@/lib/authz/permissions';
import { fail, json } from '@/lib/portal/route-kit';
import { devFixturesEnabled, getPorts, readSession } from '@/lib/portal/seam';
import type { PortalSession } from '@/lib/portal/types';
import { getDashboardPorts, type DashboardPorts } from './ports';
import { parseSimulate, simulated, type Widget } from '@/lib/dashboard/simulate';

export const SLOW_MS = 4000;

/** Store scope and role check. Live: `authorizeStore`. Fixture run: the same two rules from the fixture viewer (no commercetools). */
async function authorize(session: PortalSession, storeKey: string, action: PortalAction): Promise<void> {
  if (!devFixturesEnabled()) return authorizeStore(session, storeKey, action);
  if (!session.storeKey || session.storeKey !== storeKey) throw new ApiError(403, 'Forbidden');
  const viewer = await getPorts().loadViewer(session);
  if (!viewer || !can({ roles: viewer.roles, ctPermissions: viewer.ctPermissions }, action)) throw new ApiError(403, 'Forbidden');
}

export interface DashboardRouteOptions<T> {
  widget: Widget;
  /** Defaults to `dashboard.view`. */
  action?: PortalAction;
  /** The answer of `?simulate=<widget>-empty` (development only). */
  empty: T;
  read: (storeKey: string, ports: DashboardPorts) => Promise<T>;
}

export function dashboardRoute<T>({ widget, action = 'dashboard.view', empty, read }: DashboardRouteOptions<T>) {
  return handle(async (request: Request): Promise<Response> => {
    const session = await readSession();
    requireBusinessUnit(session);
    const storeKey = session.storeKey;
    if (!storeKey) throw new ApiError(403, 'Forbidden');
    await authorize(session, storeKey, action);

    const switches = parseSimulate(new URL(request.url).searchParams.get('simulate'));
    if (simulated(switches, widget, 'slow')) await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    if (simulated(switches, widget, 'down')) return fail(502, 'unavailable');
    if (simulated(switches, widget, 'empty')) return json(empty);
    try {
      return json(await read(storeKey, getDashboardPorts()));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`dashboard widget failed: widget=${widget} class=${error instanceof Error ? error.constructor.name : typeof error}`);
      return fail(502, 'unavailable');
    }
  });
}
