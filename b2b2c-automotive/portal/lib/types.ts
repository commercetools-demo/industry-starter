// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// App types: the boundary between commercetools and components. Components import from here, never from lib/ct or the SDK.
import type { AppLocale } from '@/i18n/config';

export type LocalizedString = Record<string, string>;

export interface Money {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

/**
 * The portal session payload (ids and flags only, no personal data). Later workstreams extend this interface and
 * `SESSION_KEYS` in `lib/session-core.ts` in the same commit.
 */
export interface Session {
  customerId?: string;
  businessUnitKey?: string;
  /** Also the Contentools namespace. */
  storeKey?: string;
  distributionChannelId?: string;
  supplyChannelId?: string;
  productSelectionId?: string;
  accountGroupIds?: string[];
  cartId?: string;
  locale?: AppLocale;
  currency?: string;
  country?: string;
  /** Reduced session (R-06): every business unit of the customer is inactive. Only `customerId` and `pending` are set. */
  pending?: boolean;
  /** Display name of the customer an Admin is shopping as (R-15, V-06). The seller's own `customerId` is untouched. */
  actingAs?: string;
}

/** The four store fields, always written to the session together. */
export interface StoreContext {
  storeKey: string;
  distributionChannelId: string;
  supplyChannelId: string;
  productSelectionId: string;
}

/** The five business-unit and store fields, always written to the session together. */
export interface BusinessContext extends StoreContext {
  businessUnitKey: string;
  accountGroupIds: string[];
}

export interface ChannelRef {
  id: string;
  key: string;
}

export interface StoreSummary extends StoreContext {
  key: string;
  /** Display name in the default locale; callers pick another locale from `nameLocalized`. */
  name: string;
  nameLocalized: LocalizedString;
  countries: string[];
  currencies: string[];
  /** All of the store's channels sorted by key; the default pair in `StoreContext` is the first of each. */
  distributionChannels: ChannelRef[];
  supplyChannels: ChannelRef[];
}

/** The two seeded associate roles (keys in `lib/roles.ts`). */
export type LogicalRole = 'admin' | 'buyer';

export type UnitStatus = 'Active' | 'Inactive' | 'Pending';

/** A business unit the signed-in associate belongs to, as the app sees it (no SDK types). */
export interface BusinessUnitView {
  key: string;
  name: string;
  unitType: 'Company' | 'Division';
  status: UnitStatus;
  parentKey?: string;
  /** `Explicit`: the unit lists its own stores; `FromParent`: it uses the nearest parent's. */
  storeMode: 'Explicit' | 'FromParent';
  /** Keys of the stores in effect (own, or the nearest parent's when `storeMode` is `FromParent`). */
  storeKeys: string[];
  /** Role keys of this customer in this unit (direct assignments only). */
  roleKeys: string[];
}

/** What a signed-in associate may do in the active unit, from their associate roles. */
export interface AssociateRoles {
  roleKeys: string[];
  roles: LogicalRole[];
  /** commercetools permission strings, for example `CreateMyCarts`. */
  ctPermissions: string[];
}
