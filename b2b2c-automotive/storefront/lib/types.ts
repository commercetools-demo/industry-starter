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
 * The session payload (ids only, no personal data). Later workstreams extend this interface and `SESSION_KEYS`
 * in `lib/session-core.ts` in the same commit.
 */
export interface Session {
  customerId?: string;
  cartId?: string;
  locale?: AppLocale;
  currency?: string;
  country?: string;
  storeKey?: string;
  distributionChannelId?: string;
  supplyChannelId?: string;
  productSelectionId?: string;
}

/** The four store fields, always written to the session together. */
export interface StoreContext {
  storeKey: string;
  distributionChannelId: string;
  supplyChannelId: string;
  productSelectionId: string;
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
  /** `store.countries`: informational only, nothing enforces it (Q-O03). Stores carry no currencies in commercetools. */
  countries: string[];
  /** All of the store's channels sorted by key; the default pair in `StoreContext` is the first of each. */
  distributionChannels: ChannelRef[];
  supplyChannels: ChannelRef[];
}
