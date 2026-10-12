// The one place the shell and the auth routes reach the session and commercetools:
//   session  -> G's signed session cookie (`lib/session.ts`), imported lazily
//   ports    -> the commercetools implementation (`lib/portal/live-ports.ts`), or, in development with PORTAL_DEV_FIXTURES=on
//               and never in production, in-memory fixture users so the shell can be run and checked without credentials (OA-01).
// The session is always the real signed cookie, so the proxy and the layout guard behave exactly as in production.
import 'server-only';
import { fixturePorts } from './dev-fixtures';
import type { PortalPorts } from './ports';
import type { PortalSession } from './types';

export function devFixturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.PORTAL_DEV_FIXTURES === 'on';
}

const session = () => import('@/lib/session');

export async function readSession(): Promise<PortalSession> {
  return (await session()).getSession();
}

/** Read, transform, write once. */
export async function writeSession(patch: (s: PortalSession) => PortalSession): Promise<PortalSession> {
  return (await session()).updateSession(patch);
}

export async function clearSession(): Promise<void> {
  await (await session()).clearSessionCookie();
}

let live: PortalPorts | undefined;

/** Fixture ports in development with the flag on; otherwise the commercetools ports. */
export function getPorts(): PortalPorts {
  if (devFixturesEnabled()) return fixturePorts;
  const lazy = <K extends keyof PortalPorts>(name: K) =>
    (async (...args: unknown[]) => {
      live ??= (await import('./live-ports')).livePorts;
      return (live[name] as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as PortalPorts[K];
  return {
    loadViewer: lazy('loadViewer'),
    listUnits: lazy('listUnits'),
    resolveContext: lazy('resolveContext'),
    login: lazy('login'),
    loginDemo: lazy('loginDemo'),
    listDemoAccounts: lazy('listDemoAccounts'),
    register: lazy('register'),
    createPasswordToken: lazy('createPasswordToken'),
    resetPassword: lazy('resetPassword'),
    searchParts: lazy('searchParts'),
    shippedOrders: lazy('shippedOrders'),
    pendingBusinessName: lazy('pendingBusinessName'),
  };
}
