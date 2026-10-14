// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Fixtures of the product page tests (workstream M).
import type { PdpBuyBoxProps } from './PdpBuyBox';
import type { ProductDetail, ProductSummary } from '@/lib/types';

export const GOLF_2016 = 'volkswagen.golf.2016.2-0-tdi';
export const GOLF_2022 = 'volkswagen.golf.2022.2-0-tdi';

export const detail = (over: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'p1',
  slug: 'vektra-front-brake-pad-set',
  sku: 'MLV-BP-41001',
  variants: [{ sku: 'MLV-BP-41001' }],
  name: 'Vektra front brake pad set',
  description: 'Ceramic pads.\n\nQuiet and low dust.',
  images: [
    { url: 'data:image/svg+xml;base64,PHN2Zy8+', alt: 'Front view', width: 800, height: 600 },
    { url: 'data:image/svg+xml;base64,PHN2Zy8+#2', alt: 'Side view', width: 800, height: 600 },
  ],
  brand: 'Vektra',
  qualityLabel: 'OEM',
  partNumber: 'BP-41001',
  oeNumbers: ['5Q0 698 151'],
  rating: { average: 4.5, count: 12 },
  price: { centAmount: 5490, currencyCode: 'USD', fractionDigits: 2 },
  stock: { atBranch: true, quantity: 4 },
  specs: [
    { name: 'part-number', value: 'BP-41001' },
    { name: 'brand', value: 'Vektra' },
    { name: 'warranty-months', value: '24' },
  ],
  universalFit: false,
  fitmentKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'],
  recurringEligible: false,
  relatedSkus: [],
  categoryTrail: [{ id: 'c1', slug: 'brakes', name: 'Brakes' }],
  ...over,
});

export const summary = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 'r1',
  sku: 'MLV-BD-42001',
  slug: 'vektra-brake-disc',
  name: 'Vektra brake disc',
  brand: 'Vektra',
  imageAlt: 'Disc',
  rating: null,
  price: { centAmount: 8900, currencyCode: 'USD', fractionDigits: 2 },
  stock: { atBranch: true, quantity: 2 },
  universalFit: true,
  fitmentKeys: [],
  recurringEligible: false,
  variantCount: 1,
  ...over,
});

export const boxProps = (over: Partial<PdpBuyBoxProps> = {}): PdpBuyBoxProps => ({
  product: detail(),
  branch: { name: 'Küstenwerk Hamburg-Harburg', address: { street: 'Harburger Ring 1', postalCode: '21073', city: 'Hamburg' }, pickup: 'today' },
  canChangeStore: true,
  shipDays: { min: 2, max: 3 },
  store: 'mau-reseller-north',
  returnDays: 30,
  sellerName: 'Küstenwerk Autoteile',
  subscriptionsEnabled: true,
  alternativesHref: '/mau-reseller-north/category/brakes',
  ...over,
});

