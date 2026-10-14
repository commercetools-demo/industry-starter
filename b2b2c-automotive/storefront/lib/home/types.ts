// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// What the home page reads once on the server and hands to the blocks through HomeDataContext (workstream K). Plain JSON only.
import type { FitState } from '@/lib/search/fitment';
import type { NavCategory, PickupOption, ProductSummary, Vehicle } from '@/lib/types';

export interface HomeData {
  storeKey: string;
  storeName: string;
  /** The selected branch (or the first one); null for a store without branches. */
  branch: { city: string; name: string } | null;
  pickup: PickupOption;
  shipDays: { min: number; max: number };
  categories: NavCategory[];
  /** Up to 8 most popular products of the store, fit-only when a vehicle is active. Empty when not requested or not readable. */
  popular: Array<{ product: ProductSummary; fit: FitState }>;
  vehicle: Vehicle | null;
}
