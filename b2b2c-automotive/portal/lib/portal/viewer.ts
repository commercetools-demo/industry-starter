// The signed-in associate for server components, resolved once per request (layout and pages share it).
import 'server-only';
import { cache } from 'react';
import { can, type PortalAction } from '@/lib/authz/permissions';
import { getPorts, readSession } from './seam';
import type { PortalSession, Viewer } from './types';

export const getPortalSession = cache(readSession);

/** The viewer, or null when nobody is signed in, the session is reduced (pending) or the user cannot be resolved. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getPortalSession();
  if (!session.customerId || session.pending || !session.businessUnitKey) return null;
  return getPorts().loadViewer(session);
});

export const isSignedIn = (session: PortalSession) => Boolean(session.customerId) && !session.pending;

/** Server-side gate of a page: true when the viewer's roles allow the action. */
export async function viewerCan(action: PortalAction): Promise<boolean> {
  const viewer = await getViewer();
  return viewer ? can({ roles: viewer.roles, ctPermissions: viewer.ctPermissions }, action) : false;
}
