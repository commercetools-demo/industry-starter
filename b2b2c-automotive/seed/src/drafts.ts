// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { CONTRACT_TYPE_KEYS, K, ls } from './data/base';
import { TAILORINGS, tailoringImageKey, tailoringKey, type TailoredImage, type TailoringDef } from './data/content';
import { keyOfSku } from './data/items';
import { BUSINESS_UNITS, ROLE_KEYS, STORES, type BuDef, type CustomerDef } from './data/org';
import { BRANCHES } from './data/org';

type Obj = Record<string, unknown>;

const STREETS: Record<string, { streetName: string; streetNumber: string; postalCode: string; city: string }> = {
  DE: { streetName: 'Beispielweg', streetNumber: '1', postalCode: '20095', city: 'Hamburg' },
  US: { streetName: 'Example Street', streetNumber: '100', postalCode: '78701', city: 'Austin' },
};

/** Value of the customer custom field `garage` (JSON, at most 5 vehicles). */
export const garageJson = (c: CustomerDef): string => JSON.stringify({ vehicles: c.garage ?? [], activeId: c.activeId ?? null });

export function customerDraft(c: CustomerDef, password: string): Obj {
  const address = { country: c.country, firstName: c.firstName, lastName: c.lastName, email: c.email, ...STREETS[c.country] };
  return {
    key: c.key, email: c.email, password, firstName: c.firstName, lastName: c.lastName, locale: c.locale, isEmailVerified: true,
    addresses: [address], defaultShippingAddress: 0, defaultBillingAddress: 0,
    ...(c.store ? { stores: [{ typeId: 'store', key: c.store }] } : {}),
    // Every seeded customer is a demo account (listed by the demo login pickers); only shoppers have a garage and consent.
    custom: {
      type: { typeId: 'type', key: CONTRACT_TYPE_KEYS.customer },
      fields: c.kind === 'shopper'
        ? { isDemo: true, garage: garageJson(c), marketingConsent: c.marketingConsent === true, ...(c.marketingConsent ? { marketingConsentAt: '2026-09-01T10:00:00.000Z' } : {}) }
        : { isDemo: true, ...(c.jobTitle ? { jobTitle: c.jobTitle } : {}) },
    },
  };
}

export function businessUnitDraft(b: BuDef): Obj {
  const base: Obj = {
    key: b.key, name: b.name, unitType: b.type, status: 'Active', contactEmail: `${b.key.replace('mau-bu-', '')}@example.com`,
    associates: b.associates.map((a) => ({
      customer: { typeId: 'customer', key: a.customer },
      associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: ROLE_KEYS[a.role] }, inheritance: 'Enabled' }],
    })),
    associateMode: b.parent ? 'ExplicitAndFromParent' : 'Explicit',
    custom: {
      type: { typeId: 'type', key: 'mau-business-unit-fields' },
      fields: { kind: b.kind, storeKey: b.storeKey ?? '', channelKey: b.channelKey ?? '', ...(b.profile ?? {}) },
    },
  };
  if (b.parent) base.parentUnit = { typeId: 'business-unit', key: b.parent };
  return base;
}

/** Images of a tailoring: recorded ones (`tailoring-images.json`) win over the placeholders in the data file. */
export const tailoredImages = (t: TailoringDef, recorded: Record<string, TailoredImage[]> = {}): TailoredImage[] => recorded[tailoringImageKey(t.store, t.sku)] ?? t.images ?? [];

/** Product tailoring draft: name, description and images of the master variant, published at once (no review). */
export function tailoringDraft(t: TailoringDef, recorded: Record<string, TailoredImage[]> = {}): Obj {
  const images = tailoredImages(t, recorded);
  return {
    key: tailoringKey(t.store, t.sku), product: { typeId: 'product', key: keyOfSku(t.sku) },
    ...(t.name ? { name: ls(t.name.de, t.name.en) } : {}),
    ...(t.description ? { description: ls(t.description.de, t.description.en) } : {}),
    ...(images.length ? { variants: [{ sku: t.sku, images }] } : {}),
    publish: true,
  };
}

export const allTailoringKeys = (): string[] => TAILORINGS.map((t) => tailoringKey(t.store, t.sku));
export const allBusinessUnitKeys = (): string[] => BUSINESS_UNITS.map((b) => b.key);
export const allStoreKeys = (): string[] => STORES.map((s) => s.key);
export const allBranchKeys = (): string[] => BRANCHES.map((b) => b.key);
export const SELECTION_FOR_STORE: Record<string, string> = { [K.storeNorth]: K.selNorth, [K.storeSouth]: K.selSouth };
