// The commercetools implementation of PortalPorts, built from workstream G's modules. Loaded lazily by lib/portal/seam.ts.
import 'server-only';
import { registerReseller } from '@/app/api/auth/register/registration';
import { getAssociateRoles } from '@/lib/ct/associate';
import { AuthError, loginCustomer } from '@/lib/ct/auth';
import { listAssociateUnits, resolveBusinessContext, resolveSignInContext } from '@/lib/ct/business-units';
import { getCustomerIdentity } from '@/lib/ct/customers';
import { createPasswordToken, resetPasswordWithToken } from '@/lib/ct/password';
import { searchParts } from '@/lib/ct/part-search';
import { touchLastActive } from '@/lib/ct/seller/customer-activity';
import { listDemoAssociates } from '@/lib/ct/seller/demo-accounts';
import { listShippedOrders } from '@/lib/ct/seller/shipped-orders';
import { getStoreContext } from '@/lib/ct/stores';
import { listDemoAccountsEmail } from './demo-credentials';
import type { LoginOutcome, PortalPorts } from './ports';
import type { UnitOption } from './types';

async function signIn(email: string, password: string, preferredUnitKey?: string): Promise<LoginOutcome> {
  try {
    const { customerId, accountGroupIds } = await loginCustomer(email, password);
    const outcome = await resolveSignInContext({ customerId, accountGroupIds, lastUnitKey: preferredUnitKey });
    // No unit at all and only inactive units both read as "awaiting approval": the account exists but cannot use the portal yet.
    if (outcome.kind !== 'ready') return { kind: 'pending', customerId };
    void touchLastActive(customerId);
    return { kind: 'ok', customerId, context: outcome.context };
  } catch (error) {
    if (error instanceof AuthError) return { kind: 'invalid' };
    throw error;
  }
}

const storeName = async (key: string) => (await getStoreContext(key))?.name ?? key;

export const livePorts: PortalPorts = {
  async loadViewer(session) {
    if (!session.customerId || !session.businessUnitKey || !session.storeKey) return null;
    const [identity, roles, units, store] = await Promise.all([
      getCustomerIdentity(session.customerId),
      getAssociateRoles(session),
      listAssociateUnits(session.customerId),
      storeName(session.storeKey),
    ]);
    const unit = units.find((u) => u.key === session.businessUnitKey);
    if (!unit) return null;
    return {
      customerId: session.customerId,
      name: identity.name,
      email: identity.email,
      roles: roles.roles,
      ctPermissions: roles.ctPermissions,
      businessUnitKey: unit.key,
      businessUnitName: unit.name,
      storeKey: session.storeKey,
      storeName: store,
      ...(session.actingAs ? { actingAs: session.actingAs } : {}),
    };
  },

  async listUnits(session) {
    if (!session.customerId) return [];
    const units = (await listAssociateUnits(session.customerId)).filter((u) => u.status === 'Active' && u.storeKeys.length > 0);
    const names = new Map(await Promise.all([...new Set(units.flatMap((u) => u.storeKeys))].map(async (k) => [k, await storeName(k)] as const)));
    return units.map<UnitOption>((u) => ({
      key: u.key,
      name: u.name,
      kind: u.unitType,
      stores: u.storeKeys.map((key) => ({ key, name: names.get(key) ?? key, mode: u.storeMode })),
    }));
  },

  async resolveContext(session, businessUnitKey, storeKey) {
    if (!session.customerId) return null;
    try {
      return await resolveBusinessContext({ customerId: session.customerId, businessUnitKey, storeKey, accountGroupIds: session.accountGroupIds ?? [] });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unit not available') return null;
      throw error;
    }
  },

  login: (email, password, opts) => signIn(email, password, opts?.preferredUnitKey),

  async loginDemo(customerId) {
    const credentials = await listDemoAccountsEmail(customerId);
    return credentials ? signIn(credentials.email, credentials.password) : { kind: 'invalid' };
  },

  async listDemoAccounts() {
    return (await listDemoAssociates()).map(({ id, label, group }) => ({ id, label, group }));
  },

  register: (input) => registerReseller(input),
  createPasswordToken,
  resetPassword: resetPasswordWithToken,
  searchParts: (storeKey, query) => searchParts(storeKey, query, 'de-DE'),
  shippedOrders: (session) => listShippedOrders(session),

  async pendingBusinessName(session) {
    if (!session.customerId) return undefined;
    return (await listAssociateUnits(session.customerId))[0]?.name;
  },
};
