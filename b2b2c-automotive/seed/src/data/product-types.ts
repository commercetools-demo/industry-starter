// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { AttributeDefinitionDraft, ProductTypeDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/** Fictional brands (no real trademarks; the prototype's brand names are placeholders and are not reused). */
export const BRANDS = [
  { key: 'vektra', label: 'Vektra' },
  { key: 'kestrel', label: 'Kestrel' },
  { key: 'nordlicht', label: 'Nordlicht' },
  { key: 'alpendyn', label: 'Alpendyn' },
  { key: 'rheinwerk', label: 'Rheinwerk' },
  { key: 'voltaris', label: 'Voltaris' },
  { key: 'malva-select', label: 'Malva Select' },
] as const;
export type BrandKey = (typeof BRANDS)[number]['key'];

export const QUALITY_TIERS = [
  { key: 'oem', de: 'Erstausrüster (OEM)', en: 'Original equipment (OEM)' },
  { key: 'oes', de: 'Erstausrüsterqualität (OES)', en: 'OE supplier quality (OES)' },
  { key: 'premium', de: 'Premium Ersatzteil', en: 'Premium aftermarket' },
  { key: 'economy', de: 'Economy', en: 'Economy' },
] as const;
export type QualityKey = (typeof QUALITY_TIERS)[number]['key'];

export const POSITIONS = [
  { key: 'front', de: 'Vorderachse', en: 'Front' },
  { key: 'rear', de: 'Hinterachse', en: 'Rear' },
  { key: 'left', de: 'Links', en: 'Left' },
  { key: 'right', de: 'Rechts', en: 'Right' },
  { key: 'not-applicable', de: 'Nicht zutreffend', en: 'Not applicable' },
] as const;
export type PositionKey = (typeof POSITIONS)[number]['key'];

export const REVIEW_STATES = ['approved', 'pending', 'rejected'] as const;

const text = (name: string, de: string, en: string, searchable = true): AttributeDefinitionDraft => ({
  name, label: ls(de, en), isRequired: false, isSearchable: searchable, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'text' },
});

export const partAttributes: AttributeDefinitionDraft[] = [
  { ...text('part-number', 'Teilenummer', 'Part number'), isRequired: true },
  {
    name: 'brand', label: ls('Marke', 'Brand'), isRequired: true, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine',
    type: { name: 'enum', values: BRANDS.map((b) => ({ key: b.key, label: b.label })) },
  },
  {
    name: 'quality-tier', label: ls('Qualitätsstufe', 'Quality tier'), isRequired: true, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine',
    type: { name: 'enum', values: QUALITY_TIERS.map((q) => ({ key: q.key, label: q.en })) },
  },
  {
    name: 'position', label: ls('Position', 'Position'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine',
    type: { name: 'enum', values: POSITIONS.map((p) => ({ key: p.key, label: p.en })) },
  },
  { name: 'warranty-months', label: ls('Garantie (Monate)', 'Warranty (months)'), isRequired: true, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'number' } },
  { name: 'oem-numbers', label: ls('OE-Nummern', 'OE numbers'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'set', elementType: { name: 'text' } } },
  // Fitment is YEAR RANGES (Q-J03), flat and searchable: one text value per vehicle generation and engine,
  // `make|model|year-from|year-to|engine`. There is no per-year vehicle id; a shopper's year is matched to the range by the finder.
  { name: 'fitment-keys', label: ls('Passende Fahrzeuge', 'Fitting vehicles'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'set', elementType: { name: 'text' } } },
  { name: 'universal-fit', label: ls('Universell passend', 'Universal fit'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'boolean' } },
  { name: 'core-charge-eur', label: ls('Altteilpfand (EUR)', 'Core charge (EUR)'), isRequired: false, isSearchable: false, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'money' } },
  { name: 'core-charge-usd', label: ls('Altteilpfand (USD)', 'Core charge (USD)'), isRequired: false, isSearchable: false, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'money' } },
  { name: 'recurring-eligible', label: ls('Abo-fähig', 'Subscribable'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'boolean' } },
  text('size-spec', 'Abmessung / Spezifikation', 'Size / specification', false),
];

export const localPartAttributes: AttributeDefinitionDraft[] = [
  { ...text('part-number', 'Teilenummer', 'Part number'), isRequired: true },
  text('brand-name', 'Marke', 'Brand'),
  { ...text('owner-store', 'Eigentümer-Shop', 'Owning store'), isRequired: true },
  {
    name: 'review-state', label: ls('Prüfstatus', 'Review state'), isRequired: true, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine',
    type: { name: 'enum', values: REVIEW_STATES.map((s) => ({ key: s, label: s })) },
  },
  { name: 'recurring-eligible', label: ls('Abo-fähig', 'Subscription eligible'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'boolean' } },
];
// Deliberately NO fitment-keys here: a local product cannot claim vehicle compatibility (design-bundles-and-product-import).

export const bundleAttributes: AttributeDefinitionDraft[] = [
  { ...text('part-number', 'Teilenummer', 'Part number'), isRequired: true },
  { name: 'component-skus', label: ls('Komponenten (SKU)', 'Components (SKU)'), isRequired: true, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'set', elementType: { name: 'text' } } },
  { name: 'component-quantities', label: ls('Komponentenmengen (sku:menge)', 'Component quantities (sku:qty)'), isRequired: true, isSearchable: false, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'set', elementType: { name: 'text' } } },
  { name: 'bundle-discount-percent', label: ls('Set-Rabatt (%)', 'Bundle discount (%)'), isRequired: true, isSearchable: false, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'number' } },
  { name: 'owner-store', label: ls('Eigentümer-Shop (leer = Malva)', 'Owning store (empty = Malva)'), isRequired: false, isSearchable: true, attributeConstraint: 'None', inputHint: 'SingleLine', type: { name: 'text' } },
];

export const productTypeDrafts: ProductTypeDraft[] = [
  { key: K.ptPart, name: 'Malva part', description: 'Master part: fitment (year ranges), quality tier, warranty, brand, OE numbers, subscribable flag. Prices are standalone.', attributes: partAttributes },
  { key: K.ptLocalPart, name: 'Malva local part', description: 'Reseller-owned part. Carries no fitment attributes.', attributes: localPartAttributes },
  { key: K.ptBundle, name: 'Malva bundle', description: 'Parts sold together at a bundle price.', attributes: bundleAttributes },
];
