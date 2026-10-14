/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Shapes shared by the shell, the auth screens and their Route Handlers (workstream R). No server imports here:
// client components import these types.
import type { LogicalRole, Session } from '@/lib/types';

/** The session payload (`lib/types.ts`, which already carries `pending` and `actingAs` for R). */
export type PortalSession = Session;

export type StoreMode = 'FromParent' | 'Explicit';

export interface StoreOption {
  key: string;
  name: string;
  mode: StoreMode;
}

export interface UnitOption {
  key: string;
  name: string;
  kind: 'Company' | 'Division';
  stores: StoreOption[];
}

/** What the shell needs to render for a signed-in user. */
export interface Viewer {
  customerId: string;
  name: string;
  email: string;
  roles: LogicalRole[];
  ctPermissions: string[];
  businessUnitKey: string;
  businessUnitName: string;
  storeKey: string;
  storeName: string;
  actingAs?: string;
}

export interface CurrentUnitResponse {
  businessUnitKey: string;
  storeKey: string;
  roles: LogicalRole[];
  ctPermissions: string[];
}

export interface UnitsResponse {
  current: { businessUnitKey: string; storeKey: string };
  units: UnitOption[];
}

export interface DemoAccount {
  id: string;
  label: string;
  group: string;
}

export interface PartHit {
  sku: string;
  name: string;
  oe?: string;
}

export type NotificationKind = 'order-shipped' | 'return-received';
export interface PortalNotification {
  id: string;
  kind: NotificationKind;
  /** next-intl message values; the title key is derived from `kind`. */
  values: Record<string, string>;
  href: string;
}
