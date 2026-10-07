// Listing fixtures: J's seeded-catalog offers (`lib/offers/__fixtures__/offers.ts`) completed with what a listing needs and J's
// fixtures leave out: categories, terms and prices on the variants, the headline, bullets, badge, chip attributes and add-on tags.
import {
  ALL_OFFERS,
  appletv,
  cable100,
  cable500,
  cableExisting,
  cableGig,
  cloud200,
  deviceProtect,
  gateway5g,
  meshBe9300,
  modemDocsis31,
  netflix,
  phoneEssential,
  phonePlus,
  phoneUnlimited,
  phoneUnlimitedMax,
  routerAc1200,
  routerAx3000,
  secure,
  spotify,
  wireless5g,
  wireless5gPlus,
  wirelessLite,
} from '@/lib/offers/__fixtures__/offers';
import type { AddonFacts, Category, Money, Offer, OfferVariant, PlanFacts, TermKey, TermMonths } from '@/lib/types';

export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

const TERM: Record<'M2M' | '12M' | '24M', { term: TermKey; months: TermMonths }> = {
  M2M: { term: 'month-to-month', months: 0 },
  '12M': { term: '12-months', months: 12 },
  '24M': { term: '24-months', months: 24 },
};

/** Variants in manifest order: the first one is the master (D-011). */
export function termVariants(prefix: string, list: [keyof typeof TERM, number][]): OfferVariant[] {
  return list.map(([token, cents], index) => ({
    id: index + 1,
    sku: `${prefix}-${token}`,
    isMaster: index === 0,
    term: TERM[token].term,
    termMonths: TERM[token].months,
    recurringPrice: usd(cents),
    images: [],
    attributes: {},
  }));
}

function listedPlan(offer: Offer, category: string, list: [keyof typeof TERM, number][], facts: Partial<PlanFacts>, extra: Partial<Offer> = {}): Offer {
  const variants = termVariants(offer.key.replace('malva-offer-', 'MLV-'), list);
  const master = variants[0];
  return {
    ...offer,
    categoryKeys: [category],
    primaryCategoryKey: category,
    variants,
    headline: { recurring: master.recurringPrice, term: master.term, termMonths: master.termMonths },
    facts: { ...(offer.facts as PlanFacts), highlights: ['Fast and reliable', 'No data caps'], ...facts },
    ...extra,
  };
}

const CABLE = 'malva-cat-cable-internet';
const WIRELESS = 'malva-cat-home-wireless';
const PHONE = 'malva-cat-phone-plans';

export const LISTED_CABLE_100 = listedPlan(cable100, CABLE, [['24M', 3999], ['M2M', 4999], ['12M', 4499]], { downstreamMbps: 100 });
export const LISTED_CABLE_500 = listedPlan(cable500, CABLE, [['24M', 5999], ['M2M', 6999], ['12M', 6499]], { downstreamMbps: 500, badge: 'most-popular' });
export const LISTED_CABLE_GIG = listedPlan(cableGig, CABLE, [['24M', 7999], ['M2M', 8999], ['12M', 8499]], { downstreamMbps: 1000 });
export const LISTED_CABLE_EXISTING = listedPlan(cableExisting, CABLE, [['24M', 4999]], { downstreamMbps: 500 }, { existingCustomer: 'existing' });
export const LISTED_WIRELESS_LITE = listedPlan(wirelessLite, WIRELESS, [['12M', 4500], ['M2M', 5000]], { networkGeneration: '4g' });
export const LISTED_WIRELESS_5G = listedPlan(wireless5g, WIRELESS, [['12M', 5500], ['M2M', 6000]], { networkGeneration: '5g', badge: 'most-popular' });
export const LISTED_WIRELESS_5G_PLUS = listedPlan(wireless5gPlus, WIRELESS, [['12M', 7500], ['M2M', 8000]], { networkGeneration: '5g' });
export const LISTED_PHONE_ESSENTIAL = listedPlan(phoneEssential, PHONE, [['M2M', 2500], ['12M', 2300]], { dataGb: 5 });
export const LISTED_PHONE_PLUS = listedPlan(phonePlus, PHONE, [['M2M', 3500], ['12M', 3300], ['24M', 3100]], { dataGb: 20 });
export const LISTED_PHONE_UNLIMITED = listedPlan(phoneUnlimited, PHONE, [['M2M', 5000], ['12M', 4800], ['24M', 4600]], { dataGb: -1, badge: 'most-popular' });
export const LISTED_PHONE_UNLIMITED_MAX = listedPlan(phoneUnlimitedMax, PHONE, [['M2M', 6500], ['12M', 6300], ['24M', 6100]], { dataGb: -1 });
/** Same product as Unlimited, restricted to the web channel (the live `malva-offer-phone-online-only`). */
export const LISTED_PHONE_ONLINE_ONLY: Offer = {
  ...LISTED_PHONE_UNLIMITED,
  id: 'id-malva-offer-phone-online-only',
  key: 'malva-offer-phone-online-only',
  name: 'Unlimited online only',
  channels: ['online'],
  variants: termVariants('MLV-PHONE-ONLINE', [['M2M', 4500]]),
  headline: { recurring: usd(4500), term: 'month-to-month', termMonths: 0 },
};

function listedAddon(offer: Offer, category: string, cents: number, tag: AddonFacts['tag']): Offer {
  const variants: OfferVariant[] = [{ ...offer.variants[0], recurringPrice: usd(cents), oneTimePrice: undefined }];
  return {
    ...offer,
    categoryKeys: [category],
    primaryCategoryKey: category,
    variants,
    headline: { recurring: usd(cents), term: null, termMonths: null },
    facts: { ...(offer.facts as AddonFacts), tag, highlights: [`${offer.name} for your plan`] },
  };
}

const STREAMING = 'malva-cat-streaming';
const PROTECTION = 'malva-cat-protection';
export const LISTED_SPOTIFY = listedAddon(spotify, STREAMING, 1000, 'music');
export const LISTED_APPLETV = listedAddon(appletv, STREAMING, 1000, 'video');
export const LISTED_NETFLIX = listedAddon(netflix, STREAMING, 800, 'video');
export const LISTED_SECURE = listedAddon(secure, PROTECTION, 500, 'extras');
export const LISTED_DEVICE_CARE = listedAddon(deviceProtect, PROTECTION, 1200, 'extras');
export const LISTED_CLOUD = listedAddon(cloud200, PROTECTION, 300, 'extras');

const withCategory = (offer: Offer): Offer => ({ ...offer, categoryKeys: ['malva-cat-equipment'], primaryCategoryKey: 'malva-cat-equipment', headline: { recurring: offer.variants[0].recurringPrice, term: null, termMonths: null } });
export const LISTED_ROUTER_AC1200 = withCategory(routerAc1200);
export const LISTED_ROUTER_AX3000 = withCategory(routerAx3000);
export const LISTED_MESH = withCategory(meshBe9300);
export const LISTED_MODEM = withCategory(modemDocsis31);
export const LISTED_GATEWAY = withCategory(gateway5g);

export const LISTED_PLANS: Offer[] = [
  LISTED_CABLE_100,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_WIRELESS_LITE,
  LISTED_WIRELESS_5G,
  LISTED_WIRELESS_5G_PLUS,
  LISTED_PHONE_ESSENTIAL,
  LISTED_PHONE_PLUS,
  LISTED_PHONE_UNLIMITED,
  LISTED_PHONE_UNLIMITED_MAX,
];
export const LISTED_ADDONS: Offer[] = [LISTED_SPOTIFY, LISTED_APPLETV, LISTED_NETFLIX, LISTED_SECURE, LISTED_DEVICE_CARE, LISTED_CLOUD];
export const LISTED_EQUIPMENT: Offer[] = [LISTED_ROUTER_AC1200, LISTED_ROUTER_AX3000, LISTED_MESH, LISTED_MODEM, LISTED_GATEWAY];

/** The whole catalog of the fixtures, with the real offers J's tests use replaced by their listed versions. */
export const LISTED_ALL: Offer[] = [...LISTED_PLANS, LISTED_CABLE_EXISTING, ...LISTED_ADDONS, ...LISTED_EQUIPMENT];
export const ORIGINAL_ALL = ALL_OFFERS;

const category = (key: string, slug: string, deSlug: string, name: string, children: Category[] = []): Category => ({
  id: `id-${key}`,
  key,
  name,
  slug,
  slugs: { 'en-US': slug, 'de-DE': deSlug },
  orderHint: undefined,
  children,
});

/** A tree like the seeded one: five roots, three children under Add-ons. */
export const TREE: Category[] = [
  category('malva-cat-phone-plans', 'phone-plans', 'handytarife', 'Phone plans'),
  category('malva-cat-home-wireless', 'home-wireless-internet', 'heimnetz-funk', 'Wireless internet'),
  category('malva-cat-cable-internet', 'cable-internet', 'kabel-internet', 'Cable internet'),
  category('malva-cat-add-ons', 'add-ons', 'zusatzoptionen', 'Add-ons', [
    category('malva-cat-streaming', 'streaming-entertainment', 'streaming-unterhaltung', 'Streaming and entertainment'),
    category('malva-cat-protection', 'security-and-protection', 'sicherheit-schutz', 'Security and protection'),
    category('malva-cat-equipment', 'routers-and-equipment', 'router-und-zubehoer', 'Routers and equipment'),
  ]),
  category('malva-cat-devices', 'phones-and-devices', 'handys-und-geraete', 'Phones and devices'),
];
