// Development fixtures: synthetic users, units and stores behind the `PORTAL_DEV_FIXTURES=on` flag (never in production).
// They stand in for commercetools until workstream G lands; names are neutral on purpose (plan R decision 8).
import type { LogicalRole } from '@/lib/authz/permissions';
import type { PortalPorts, LoginOutcome } from './ports';
import type { DemoAccount, PartHit, PortalSession, UnitOption, Viewer } from './types';

export interface FixtureUser {
  id: string;
  who: 'adminA' | 'buyerA' | 'adminB' | 'pending';
  name: string;
  email: string;
  role: LogicalRole | null;
  business: string;
  /** Pending users have no active unit. */
  pending?: boolean;
  demo?: boolean;
}

export const FIXTURE_USERS: FixtureUser[] = [
  { id: 'fx-cust-north-admin', who: 'adminA', name: 'Alex Admin', email: 'admin.a@example.com', role: 'admin', business: 'north', demo: true },
  { id: 'fx-cust-north-buyer', who: 'buyerA', name: 'Bea Buyer', email: 'buyer.a@example.com', role: 'buyer', business: 'north', demo: true },
  { id: 'fx-cust-south-admin', who: 'adminB', name: 'Sam Admin', email: 'admin.b@example.com', role: 'admin', business: 'south', demo: true },
  { id: 'fx-cust-west-admin', who: 'pending', name: 'Pat Pending', email: 'pending@example.com', role: 'admin', business: 'west', pending: true },
];

const STORE_ONLINE = { key: 'fx-store-online', name: 'DACH Online' } as const;
const STORE_DIRECT = { key: 'fx-store-direct', name: 'Workshop Direct' } as const;

const UNITS: Record<string, UnitOption[]> = {
  north: [
    { key: 'fx-bu-north', name: 'Test Garage Nord', kind: 'Company', stores: [{ ...STORE_ONLINE, mode: 'Explicit' }] },
    { key: 'fx-bu-north-hh', name: 'Test Garage Nord Hamburg', kind: 'Division', stores: [{ ...STORE_ONLINE, mode: 'FromParent' }, { ...STORE_DIRECT, mode: 'Explicit' }] },
    { key: 'fx-bu-north-be', name: 'Test Garage Nord Berlin', kind: 'Division', stores: [{ ...STORE_DIRECT, mode: 'Explicit' }, { ...STORE_ONLINE, mode: 'FromParent' }] },
  ],
  south: [{ key: 'fx-bu-south', name: 'Test Garage Süd', kind: 'Company', stores: [{ key: 'fx-store-south', name: 'Süd Online', mode: 'Explicit' }] }],
  west: [],
};

const PENDING_NAMES: Record<string, string> = { west: 'Test Garage West' };

export const fixtureUser = (id: string | undefined) => FIXTURE_USERS.find((u) => u.id === id);

export function fixtureViewer(session: PortalSession): Viewer | null {
  const user = fixtureUser(session.customerId);
  if (!user || user.pending || !user.role) return null;
  const units = UNITS[user.business] ?? [];
  const unit = units.find((u) => u.key === session.businessUnitKey) ?? units[0];
  if (!unit) return null;
  const store = unit.stores.find((s) => s.key === session.storeKey) ?? unit.stores[0];
  return {
    customerId: user.id,
    name: user.name,
    email: user.email,
    roles: [user.role],
    ctPermissions: [],
    businessUnitKey: unit.key,
    businessUnitName: unit.name,
    storeKey: store.key,
    storeName: store.name,
    ...(session.actingAs ? { actingAs: session.actingAs } : {}),
  };
}

function contextOf(user: FixtureUser, unitKey?: string, storeKey?: string) {
  const units = UNITS[user.business];
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const store = unit.stores.find((s) => s.key === storeKey) ?? unit.stores[0];
  return {
    businessUnitKey: unit.key,
    storeKey: store.key,
    distributionChannelId: `${store.key}-dist`,
    supplyChannelId: `${store.key}-supply`,
    productSelectionId: `${store.key}-selection`,
    accountGroupIds: [] as string[],
  };
}

export const fixtureContext = (customerId: string, unitKey?: string, storeKey?: string) => {
  const user = fixtureUser(customerId);
  return user && !user.pending ? contextOf(user, unitKey, storeKey) : null;
};

const outcome = (user: FixtureUser): LoginOutcome =>
  user.pending ? { kind: 'pending', customerId: user.id } : { kind: 'ok', customerId: user.id, context: contextOf(user) };

const registered = new Map<string, { companyName: string; name: string }>();
const tokens = new Map<string, string>();

const PARTS: Array<PartHit & { oe: string }> = [
  { sku: 'FX-BRAKE-001', name: 'Brake disc, front vented', oe: 'OE-34116-001' },
  { sku: 'FX-BRAKE-002', name: 'Brake pad set, front', oe: 'OE-34116-002' },
  { sku: 'FX-FILTER-010', name: 'Oil filter, spin-on', oe: 'OE-11427-010' },
];

export const fixturePorts: PortalPorts = {
  async loadViewer(session) {
    return fixtureViewer(session);
  },
  async listUnits(session) {
    const user = fixtureUser(session.customerId);
    return user ? (UNITS[user.business] ?? []) : [];
  },
  async resolveContext(session, businessUnitKey, storeKey) {
    const user = fixtureUser(session.customerId);
    const unit = user ? UNITS[user.business]?.find((u) => u.key === businessUnitKey) : undefined;
    return user && unit ? contextOf(user, businessUnitKey, unit.stores.some((s) => s.key === storeKey) ? storeKey : undefined) : null;
  },
  async login(email, password) {
    const user = FIXTURE_USERS.find((u) => u.email === email.trim().toLowerCase());
    // The fixture password is synthetic and only exists behind the dev flag.
    if (!user || password !== (process.env.PORTAL_DEV_FIXTURE_PASSWORD ?? 'fixture-only-password')) return { kind: 'invalid' };
    return outcome(user);
  },
  async loginDemo(customerId) {
    const user = FIXTURE_USERS.find((u) => u.id === customerId && u.demo);
    return user ? outcome(user) : { kind: 'invalid' };
  },
  async listDemoAccounts(): Promise<DemoAccount[]> {
    const order = (u: FixtureUser) => (u.role === 'admin' ? 0 : 1);
    return FIXTURE_USERS.filter((u) => u.demo && u.role)
      .map((u) => ({ u, unit: UNITS[u.business][0] }))
      .sort((a, b) => a.unit.name.localeCompare(b.unit.name) || order(a.u) - order(b.u))
      .map(({ u, unit }) => ({ id: u.id, label: `${u.name} · ${u.role === 'admin' ? 'Admin' : 'Buyer'} · ${unit.name}`, group: unit.name }));
  },
  async register(input) {
    const email = input.email.trim().toLowerCase();
    if (registered.has(email) || FIXTURE_USERS.some((u) => u.email === email)) return 'duplicate';
    registered.set(email, { companyName: input.companyName, name: input.name });
    return 'created';
  },
  async createPasswordToken(email) {
    const known = FIXTURE_USERS.some((u) => u.email === email.trim().toLowerCase()) || registered.has(email.trim().toLowerCase());
    if (!known) return null;
    const token = crypto.randomUUID().replace(/-/g, '');
    tokens.set(token, email);
    return token;
  },
  async resetPassword(token) {
    return tokens.delete(token);
  },
  async searchParts(_storeKey, query) {
    const q = query.toLowerCase();
    return PARTS.filter((p) => p.sku.toLowerCase().includes(q) || p.oe.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 8);
  },
  async shippedOrders(session) {
    return fixtureUser(session.customerId)?.role === 'admin'
      ? [
          { id: 'fx-order-1', orderNumber: 'ORD-1001' },
          { id: 'fx-order-2', orderNumber: 'ORD-1002' },
          { id: 'fx-order-3', orderNumber: 'ORD-1003' },
        ]
      : [{ id: 'fx-order-3', orderNumber: 'ORD-1003' }];
  },
  async pendingBusinessName(session) {
    const user = fixtureUser(session.customerId);
    return user ? PENDING_NAMES[user.business] : undefined;
  },
};
