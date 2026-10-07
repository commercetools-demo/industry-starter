// Typed offers mirroring the seeded catalog (scripts/seed/data): same keys, speeds, technologies, inclusions, conflicts and
// exceptions, plus real rental/purchase prices of the equipment. Used by every lib/offers test.
import type { AddonFacts, EquipmentFacts, EquipmentKind, Money, Offer, OfferVariant, PlanFacts, PlanFamily, Technology } from '@/lib/types';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

function variant(sku: string, price: { recurring?: number; oneTime?: number }): OfferVariant {
  return {
    id: 1,
    sku,
    isMaster: true,
    term: null,
    termMonths: null,
    recurringPrice: price.recurring === undefined ? undefined : usd(price.recurring),
    oneTimePrice: price.oneTime === undefined ? undefined : usd(price.oneTime),
    images: [],
    attributes: {},
  };
}

function baseOffer(key: string, name: string, anchor: string, kind: Offer['kind']): Offer {
  return {
    id: `id-${key}`,
    key,
    kind,
    name,
    slug: key.replace('malva-offer-', ''),
    description: '',
    categoryKeys: [],
    anchors: [anchor],
    facts: null,
    includedOffers: [],
    compatibleAddons: [],
    compatibleEquipment: [],
    conflictsWith: [],
    audience: [],
    existingCustomer: 'any',
    channels: [],
    variants: [variant(`${anchor}-sku`, { recurring: 1000 })],
    headline: { term: null, termMonths: null },
  };
}

const HOME_INTERNET = ['cable-100', 'cable-500', 'cable-gig', 'cable-existing-customer', 'wireless-lite', 'wireless-5g', 'wireless-5g-plus'].map(
  (id) => `malva-offer-${id}`,
);

interface PlanSpec {
  id: string;
  name: string;
  family: PlanFamily;
  technology: Technology;
  mbps?: number;
  required?: EquipmentKind[];
  included?: string[];
  compatibleAddons?: string[];
  anchor?: string;
}

export function plan(spec: PlanSpec): Offer {
  const key = `malva-offer-${spec.id}`;
  const facts: PlanFacts = {
    kind: 'plan',
    family: spec.family,
    technology: spec.technology,
    downstreamMbps: spec.mbps,
    includedAddons: [],
    conflictsWith: [],
    requiredEquipmentKinds: spec.required ?? [],
    requiredAddonKinds: [],
    highlights: [],
  };
  return {
    ...baseOffer(key, spec.name, spec.anchor ?? `malva-${spec.id}`, 'base-package'),
    facts,
    includedOffers: (spec.included ?? []).map((id) => `malva-offer-${id}`),
    compatibleAddons: (spec.compatibleAddons ?? []).map((id) => `malva-offer-${id}`),
    conflictsWith: spec.family === 'internet' ? HOME_INTERNET.filter((other) => other !== key) : [],
  };
}

export function addon(id: string, name: string, families: PlanFamily[], technologies: Technology[] = []): Offer {
  const facts: AddonFacts = { kind: 'addon', addonKind: 'streaming', appliesToFamilies: families, appliesToTechnologies: technologies, highlights: [] };
  return { ...baseOffer(`malva-offer-${id}`, name, `malva-${id}`, 'addon'), facts };
}

export function equipment(
  id: string,
  name: string,
  kind: EquipmentKind,
  maxDownstreamMbps: number | undefined,
  technologies: Technology[],
  prices: { rent?: number; buy?: number },
  incompatibleWith: string[] = [],
): Offer {
  const facts: EquipmentFacts = { kind: 'equipment', equipmentKind: kind, maxDownstreamMbps, supportedTechnologies: technologies, incompatibleWith };
  const variants: OfferVariant[] = [];
  if (prices.rent !== undefined) variants.push(variant(`MLV-EQP-${id.toUpperCase()}-RENT`, { recurring: prices.rent }));
  if (prices.buy !== undefined) variants.push({ ...variant(`MLV-EQP-${id.toUpperCase()}-BUY`, { oneTime: prices.buy }), isMaster: variants.length === 0 });
  return { ...baseOffer(`malva-offer-${id}`, name, `malva-${id}`, 'equipment'), facts, variants };
}

export const cable100 = plan({ id: 'cable-100', name: 'Cable 100', family: 'internet', technology: 'cable', mbps: 100, required: ['modem'], included: ['modem-docsis31'] });
export const cable500 = plan({ id: 'cable-500', name: 'Cable 500', family: 'internet', technology: 'cable', mbps: 500, required: ['modem'], included: ['modem-docsis31'] });
export const cableGig = plan({
  id: 'cable-gig',
  name: 'Cable Gig',
  family: 'internet',
  technology: 'cable',
  mbps: 1000,
  required: ['modem'],
  included: ['modem-docsis31', 'appletv'],
});
/** Live extra offer anchoring the same product as Cable 500 (H report). */
export const cableExisting = plan({
  id: 'cable-existing-customer',
  name: 'Cable 500 for existing customers',
  family: 'internet',
  technology: 'cable',
  mbps: 500,
  required: ['modem'],
  included: ['modem-docsis31'],
  anchor: 'malva-cable-500',
});
export const wirelessLite = plan({ id: 'wireless-lite', name: 'Air Lite', family: 'internet', technology: 'fixed-wireless', mbps: 50, required: ['gateway'], included: ['5g-gateway'] });
export const wireless5g = plan({ id: 'wireless-5g', name: 'Air 5G', family: 'internet', technology: 'fixed-wireless', mbps: 200, required: ['gateway'], included: ['5g-gateway'] });
export const wireless5gPlus = plan({
  id: 'wireless-5g-plus',
  name: 'Air 5G Plus',
  family: 'internet',
  technology: 'fixed-wireless',
  mbps: 500,
  required: ['gateway'],
  included: ['5g-gateway'],
});
export const phoneEssential = plan({ id: 'phone-essential', name: 'Essential', family: 'phone', technology: 'mobile' });
export const phonePlus = plan({ id: 'phone-plus', name: 'Plus', family: 'phone', technology: 'mobile' });
export const phoneUnlimited = plan({ id: 'phone-unlimited', name: 'Unlimited', family: 'phone', technology: 'mobile', included: ['spotify'] });
export const phoneUnlimitedMax = plan({
  id: 'phone-unlimited-max',
  name: 'Unlimited Max',
  family: 'phone',
  technology: 'mobile',
  included: ['spotify', 'cloud-200'],
  compatibleAddons: ['netflix'],
});

export const appletv = addon('appletv', 'Apple TV+', ['internet']);
export const spotify = addon('spotify', 'Spotify', ['internet', 'phone']);
export const netflix = addon('netflix', 'Netflix', ['internet']);
export const secure = addon('secure', 'Malva Secure', ['internet']);
export const deviceProtect = addon('device-protect', 'Device Care', ['phone']);
export const cloud200 = addon('cloud-200', 'Cloud 200GB', ['internet', 'phone']);

export const routerAc1200 = equipment('router-ac1200', 'Malva WiFi 5 Router AC1200', 'router', 300, ['cable', 'fixed-wireless'], { rent: 500, buy: 7999 });
export const routerAx3000 = equipment('router-ax3000', 'Malva WiFi 6 Router AX3000', 'router', 1000, ['cable', 'fixed-wireless'], { rent: 800, buy: 12999 }, [
  'malva-offer-wireless-lite',
]);
export const meshBe9300 = equipment('mesh-be9300', 'Malva WiFi 7 Mesh BE9300', 'router', 2500, ['cable', 'fixed-wireless'], { rent: 1200, buy: 24999 });
export const modemDocsis31 = equipment('modem-docsis31', 'Malva DOCSIS 3.1 Modem', 'modem', 2000, ['cable'], { rent: 600, buy: 9999 });
export const gateway5g = equipment('5g-gateway', 'Malva 5G Home Gateway', 'gateway', 500, ['fixed-wireless'], { rent: 1000 });

export const ALL_OFFERS: Offer[] = [
  cable100,
  cable500,
  cableGig,
  cableExisting,
  wirelessLite,
  wireless5g,
  wireless5gPlus,
  phoneEssential,
  phonePlus,
  phoneUnlimited,
  phoneUnlimitedMax,
  appletv,
  spotify,
  netflix,
  secure,
  deviceProtect,
  cloud200,
  routerAc1200,
  routerAx3000,
  meshBe9300,
  modemDocsis31,
  gateway5g,
];

export const offersByKey = (offers: Offer[] = ALL_OFFERS): Record<string, Offer> => Object.fromEntries(offers.map((offer) => [offer.key, offer]));

export const withFacts = <T extends Offer>(offer: T, patch: Partial<EquipmentFacts> & Partial<AddonFacts> & Partial<PlanFacts>): T =>
  ({ ...offer, facts: { ...offer.facts, ...patch } }) as T;
