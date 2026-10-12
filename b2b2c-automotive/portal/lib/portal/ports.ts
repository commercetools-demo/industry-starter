// Ports: everything the shell and the auth routes need from commercetools, behind one interface (workstream R seam).
// SWAP: when workstream G lands (lib/ct/client.ts, lib/session.ts), implement `PortalPorts` in lib/ct/portal-ports.ts using
// R-04 (getAssociateRoles), R-06 (loginCustomer via apiRoot.login().post(), listAssociateUnits, getStoreChannelData),
// R-07 (registerReseller with the provisioning client), R-08 (passwordToken / passwordReset), R-17a (listDemoAssociates
// with the admin root) and R-13 (Product Search); then return it from `getPorts()` in lib/portal/seam.ts.
import type { BusinessContext } from '@/lib/types';
import type { DemoAccount, PartHit, PortalSession, UnitOption, Viewer } from './types';

export type LoginOutcome =
  | { kind: 'ok'; customerId: string; context: BusinessContext }
  | { kind: 'pending'; customerId: string }
  | { kind: 'invalid' };

export interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

export interface ShippedOrder {
  id: string;
  orderNumber: string;
}

export interface PortalPorts {
  /** Resolves the signed-in associate: name, roles of the current unit, unit and store names. Null when unknown. */
  loadViewer(session: PortalSession): Promise<Viewer | null>;
  /** Units (company and divisions) of the associate with the stores each can use. */
  listUnits(session: PortalSession): Promise<UnitOption[]>;
  /** The five session fields for a unit and store the customer belongs to; null for a unit that is not theirs, inactive or without a store. */
  resolveContext(session: PortalSession, businessUnitKey: string, storeKey?: string): Promise<BusinessContext | null>;
  /** Validated sign-in of email and password (same message for unknown email and wrong password). */
  login(email: string, password: string, opts?: { preferredUnitKey?: string }): Promise<LoginOutcome>;
  /** Sign-in of a listed demo account, using the server-held demo password (R-17a). */
  loginDemo(customerId: string): Promise<LoginOutcome>;
  listDemoAccounts(): Promise<DemoAccount[]>;
  register(input: RegisterInput): Promise<'created' | 'duplicate'>;
  /** Password token for a known email, null for an unknown one. */
  createPasswordToken(email: string): Promise<string | null>;
  resetPassword(token: string, password: string): Promise<boolean>;
  searchParts(storeKey: string, query: string): Promise<PartHit[]>;
  shippedOrders(session: PortalSession): Promise<ShippedOrder[]>;
  /** Name of the pending business of a reduced session. */
  pendingBusinessName(session: PortalSession): Promise<string | undefined>;
}
