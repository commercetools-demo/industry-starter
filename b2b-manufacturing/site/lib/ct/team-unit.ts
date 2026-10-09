import 'server-only';
import type { Associate, BusinessUnit, BusinessUnitUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import { apiRoot } from './client';

/** Who the signed-in customer is in a Business Unit: their roles and the permissions those roles grant (commercetools is the source of truth for both). */
export interface AssociateContext {
  unit: BusinessUnit;
  me: Associate;
  roleKeys: string[];
  permissions: ReadonlySet<string>;
}

export const forbidden = () => new ApiError(403, 'You do not have permission to do this.');

export const can = (ctx: Pick<AssociateContext, 'permissions'>, permission: string): boolean => ctx.permissions.has(permission);
/** My/Others: `own` picks the first or the second permission. */
export const canOn = (ctx: Pick<AssociateContext, 'permissions'>, own: boolean, mine: string, others: string): boolean => ctx.permissions.has(own ? mine : others);

export async function loadUnit(businessUnitKey: string): Promise<BusinessUnit> {
  return (await apiRoot.businessUnits().withKey({ key: businessUnitKey }).get({ queryArgs: { expand: ['associates[*].customer'] } }).execute()).body;
}

/** Loads the Business Unit and the customer's association with it; a customer who is not an associate of the unit gets 403. */
export async function getAssociateContext(session: { customerId: string; businessUnitKey: string }): Promise<AssociateContext> {
  const [unit, roles] = await Promise.all([loadUnit(session.businessUnitKey), apiRoot.associateRoles().get({ queryArgs: { limit: 100 } }).execute()]);
  const me = unit.associates.find((a) => a.customer.id === session.customerId);
  if (!me) throw forbidden();
  const roleKeys = me.associateRoleAssignments.map((r) => r.associateRole.key);
  const permissions = new Set(roles.body.results.filter((r) => roleKeys.includes(r.key)).flatMap((r) => r.permissions));
  return { unit, me, roleKeys, permissions };
}

export function requireAnyPermission(ctx: Pick<AssociateContext, 'permissions'>, ...needed: string[]): void {
  if (!needed.some((p) => ctx.permissions.has(p))) throw forbidden();
}

const isConflict = (error: unknown) => (error as { statusCode?: number }).statusCode === 409;

/**
 * Reads the unit, lets `build` decide the actions from that exact version (so a guard such as "last administrator" and the write
 * see the same data), and posts them. A concurrent change is retried on fresh data; the third conflict is reported.
 */
export async function updateUnit(
  businessUnitKey: string,
  build: (unit: BusinessUnit) => BusinessUnitUpdateAction[] | Promise<BusinessUnitUpdateAction[]>,
  root: Pick<typeof apiRoot, 'businessUnits'> = apiRoot,
): Promise<BusinessUnit> {
  for (let attempt = 0; ; attempt += 1) {
    const unit = await loadUnit(businessUnitKey);
    const actions = await build(unit);
    if (actions.length === 0) return unit;
    try {
      return (await root.businessUnits().withKey({ key: businessUnitKey }).post({ body: { version: unit.version, actions } }).execute()).body;
    } catch (error) {
      if (!isConflict(error)) throw error;
      if (attempt >= 2) throw new ApiError(409, 'The company was changed by someone else. Please reload and try again.');
    }
  }
}
