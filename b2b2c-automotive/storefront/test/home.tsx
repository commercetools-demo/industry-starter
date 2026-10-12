// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Test helpers of the home blocks (workstream K): a HomeData fixture and a render with the vehicle providers and HomeDataContext.
import type { ReactElement } from 'react';
import { HomeDataProvider } from '@/components/home/HomeDataContext';
import type { HomeData } from '@/lib/home/types';
import type { ProductSummary } from '@/lib/types';
import { renderVehicle, type RenderOptions } from '@/test/vehicle';

export const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 'p1',
  sku: 'MLV-BP-41001',
  slug: 'vektra-front-brake-pad-set',
  name: 'Vektra front brake pad set',
  brand: 'Vektra',
  imageAlt: 'Brake pads',
  rating: { average: 4.5, count: 12 },
  price: { centAmount: 5490, currencyCode: 'USD', fractionDigits: 2 },
  stock: { atBranch: true, quantity: 4 },
  universalFit: false,
  fitmentKeys: [],
  recurringEligible: false,
  variantCount: 1,
  ...over,
});

export const homeData = (over: Partial<HomeData> = {}): HomeData => ({
  storeKey: 'mau-reseller-north',
  storeName: 'Küstenwerk Autoteile',
  branch: { city: 'Hamburg', name: 'Küstenwerk Hamburg-Harburg' },
  pickup: 'today',
  shipDays: { min: 2, max: 3 },
  categories: [
    { id: 'c1', slug: 'brakes', name: 'Brakes' },
    { id: 'c2', slug: 'filters', name: 'Filters' },
    { id: 'c3', slug: 'engine', name: 'Engine' },
    { id: 'c4', slug: 'suspension', name: 'Suspension' },
    { id: 'c5', slug: 'lighting', name: 'Lighting' },
  ],
  popular: [],
  vehicle: null,
  ...over,
});

/** Renders a block with the en-US catalog (under de-DE market rules like renderVehicle) and the given home data. */
export function renderHome(ui: ReactElement, { home = homeData(), ...options }: { home?: HomeData } & RenderOptions = {}) {
  return renderVehicle(<HomeDataProvider value={home}>{ui}</HomeDataProvider>, options);
}
