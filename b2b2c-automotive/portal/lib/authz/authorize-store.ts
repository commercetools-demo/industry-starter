// Layer two of "permissions in two layers" (R-05): every seller write checks, BEFORE any commercetools write, that the store is
// the one the session works in and that the associate's role may perform the action. Seller endpoints under app/api/seller/**
// call this first and only then use the admin client.
import 'server-only';
import { ApiError } from '@/lib/api';
import { can, type PortalAction } from '@/lib/authz/permissions';
import { getAssociateRoles } from '@/lib/ct/associate';
import { fixtureViewer } from '@/lib/portal/dev-fixtures';
import { devFixturesEnabled } from '@/lib/portal/seam';
import type { Session } from '@/lib/types';

/**
 * Throws ApiError(403) when the session has no business unit, when `storeKey` is not the session's store (the switch
 * endpoint is the only writer of that field and only accepts the associate's own units), or when the role may not do `action`.
 * The store check runs first and needs no commercetools call.
 */
export async function authorizeStore(session: Session, storeKey: string, action: PortalAction): Promise<void> {
  if (!session.customerId || !session.businessUnitKey || session.pending) throw new ApiError(403, 'Forbidden');
  if (!session.storeKey || session.storeKey !== storeKey) throw new ApiError(403, 'Forbidden');
  // PORTAL_DEV_FIXTURES=on (never production): the fixture user's role stands in for the commercetools role lookup.
  const { roles, ctPermissions } = devFixturesEnabled() ? { roles: fixtureViewer(session)?.roles ?? [], ctPermissions: [] as string[] } : await getAssociateRoles(session);
  if (!can({ roles, ctPermissions }, action)) throw new ApiError(403, 'Forbidden');
}
