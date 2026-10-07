import 'server-only';
import type { ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/format';
import type {
  AddonFacts,
  AudienceKey,
  DeviceFacts,
  EquipmentFacts,
  EquipmentKind,
  ExistingCustomerRule,
  Market,
  Offer,
  OfferFacts,
  OfferKind,
  OfferVariant,
  PlanFacts,
  PlanFamily,
  Technology,
  TermKey,
  TermMonths,
} from '@/lib/types';
import {
  attrDate,
  attrEnumKey,
  attrEnumKeys,
  attrLocalized,
  attrLocalizedSet,
  attrNumber,
  attrString,
  attrStringSet,
  type RawAttribute,
} from './attributes';
import { selectPrices, selectRecurringPrices, type RawPrice } from './price';

type Attrs = ReadonlyArray<RawAttribute> | undefined;

const OFFER_KINDS: readonly OfferKind[] = ['base-package', 'addon', 'equipment', 'device', 'bundle'];
const AUDIENCES: readonly AudienceKey[] = ['consumer', 'small-business', 'employee'];
const EXISTING: readonly ExistingCustomerRule[] = ['any', 'existing', 'new'];
const EQUIPMENT_KINDS: readonly EquipmentKind[] = ['router', 'modem', 'extender', 'gateway'];
const ADDON_KINDS: readonly AddonFacts['addonKind'][] = ['streaming', 'security', 'protection'];
const TERMS: Record<TermKey, TermMonths> = { 'month-to-month': 0, '12-months': 12, '24-months': 24 };

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined => allowed.find((candidate) => candidate === value);
const keepAllowed = <T extends string>(allowed: readonly T[], values: string[]): T[] => allowed.filter((candidate) => values.includes(candidate));
const union = (...lists: string[][]): string[] => [...new Set(lists.flat())];
const generation = (attrs: Attrs): '4g' | '5g' | undefined => {
  const key = attrEnumKey(attrs, 'network-generation');
  return key === '4g' || key === '5g' ? key : undefined;
};
const technologies = (attrs: Attrs, name: string): Technology[] => keepAllowed<Technology>(['cable', 'fixed-wireless'], attrEnumKeys(attrs, name));

// ----- facts of the descriptive products -----

export function mapPlanFacts(projection: ProductProjection, family: PlanFamily, locale: string): PlanFacts | null {
  const attrs = projection.masterVariant.attributes;
  let technology: Technology | undefined = 'mobile';
  if (family === 'internet') {
    const key = attrEnumKey(attrs, 'technology');
    technology = key === 'cable' || key === 'fixed-wireless' ? key : undefined;
  }
  if (!technology) return null;
  return {
    kind: 'plan',
    family,
    technology,
    ...optional({
      downstreamMbps: attrNumber(attrs, 'downstream-mbps'),
      upstreamMbps: attrNumber(attrs, 'upstream-mbps'),
      typicalDownloadMbps: attrNumber(attrs, 'typical-download-mbps'),
      typicalUploadMbps: attrNumber(attrs, 'typical-upload-mbps'),
      typicalLatencyMs: attrNumber(attrs, 'typical-latency-ms'),
      dataGb: attrNumber(attrs, 'data-gb'),
      hotspotGb: attrNumber(attrs, 'hotspot-gb'),
      linesIncluded: attrNumber(attrs, 'lines-included'),
      networkGeneration: generation(attrs),
      priceLockMonths: attrNumber(attrs, 'price-lock-months'),
      earlyTerminationFee: attrLocalized(attrs, 'early-termination-fee', locale),
      badge: attrEnumKey(attrs, 'badge') === 'most-popular' ? ('most-popular' as const) : undefined,
    }),
    includedAddons: attrStringSet(attrs, 'included-addons'),
    conflictsWith: attrStringSet(attrs, 'conflicts-with'),
    requiredEquipmentKinds: keepAllowed(EQUIPMENT_KINDS, attrEnumKeys(attrs, 'required-equipment-kinds')),
    requiredAddonKinds: attrEnumKeys(attrs, 'required-addon-kinds'),
    highlights: attrLocalizedSet(attrs, 'highlights', locale),
  };
}

export function mapAddonFacts(projection: ProductProjection, locale: string): AddonFacts | null {
  const attrs = projection.masterVariant.attributes;
  const addonKind = oneOf(ADDON_KINDS, attrEnumKey(attrs, 'addon-kind'));
  if (!addonKind) return null;
  return {
    kind: 'addon',
    addonKind,
    ...optional({
      provider: attrString(attrs, 'provider'),
      chargeType: attrEnumKey(attrs, 'charge-type'),
      trialDays: attrNumber(attrs, 'trial-days'),
      tag: attrEnumKey(attrs, 'addon-tag'),
    }),
    appliesToFamilies: keepAllowed<PlanFamily>(['internet', 'phone'], attrEnumKeys(attrs, 'applies-to-families')),
    appliesToTechnologies: technologies(attrs, 'applies-to-technologies'),
    highlights: attrLocalizedSet(attrs, 'highlights', locale),
  };
}

export function mapEquipmentFacts(projection: ProductProjection): EquipmentFacts | null {
  const attrs = projection.masterVariant.attributes;
  const equipmentKind = oneOf(EQUIPMENT_KINDS, attrEnumKey(attrs, 'equipment-kind'));
  if (!equipmentKind) return null;
  return {
    kind: 'equipment',
    equipmentKind,
    ...optional({
      maxDownstreamMbps: attrNumber(attrs, 'max-downstream-mbps'),
      wifiStandard: attrEnumKey(attrs, 'wifi-standard'),
      chargeType: attrEnumKey(attrs, 'charge-type'),
    }),
    supportedTechnologies: technologies(attrs, 'supported-technologies'),
    incompatibleWith: attrStringSet(attrs, 'incompatible-with'),
  };
}

export function mapDeviceFacts(projection: ProductProjection): DeviceFacts {
  const attrs = projection.masterVariant.attributes;
  return {
    kind: 'device',
    ...optional({ brand: attrString(attrs, 'brand'), os: attrEnumKey(attrs, 'os'), networkGeneration: generation(attrs) }),
    compatiblePlanFamilies: keepAllowed<PlanFamily>(['internet', 'phone'], attrEnumKeys(attrs, 'compatible-plan-families')),
  };
}

/** Dispatch on the product type key of a descriptive (non-offer) product. */
export function mapFacts(projection: ProductProjection, productTypeKey: string, locale: string): OfferFacts | null {
  switch (productTypeKey) {
    case 'malva-internet-plan':
      return mapPlanFacts(projection, 'internet', locale);
    case 'malva-phone-plan':
      return mapPlanFacts(projection, 'phone', locale);
    case 'malva-addon':
      return mapAddonFacts(projection, locale);
    case 'malva-equipment':
      return mapEquipmentFacts(projection);
    case 'malva-device':
      return mapDeviceFacts(projection);
    default:
      return null;
  }
}

// ----- offers -----

export interface OfferContext {
  market: Market;
  categoryIdToKey: Record<string, string>;
  now: Date;
}

/** Drops `undefined` values so the result is plain JSON (the cache and the client boundary serialise it). */
function optional<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function mapVariant(variant: ProductVariant, isMaster: boolean, kind: OfferKind, ctx: OfferContext): OfferVariant {
  const attrs = variant.attributes;
  const sku = variant.sku ?? '';
  const prices = (variant.prices ?? []) as RawPrice[];
  const selected = selectPrices(prices, ctx.market, ctx.now, sku);
  const term = oneOf(Object.keys(TERMS) as TermKey[], attrEnumKey(attrs, 'contract-term')) ?? null;
  const plain: OfferVariant['attributes'] = {};
  for (const name of ['color', 'memory-gb', 'contract-term', 'charge-type']) {
    const key = attrEnumKey(attrs, name);
    if (key !== undefined) plain[name] = key;
  }
  const financed = kind === 'device' ? selectRecurringPrices(prices, ctx.market, ctx.now, sku) : [];
  return {
    id: variant.id,
    sku,
    isMaster,
    term,
    termMonths: term ? TERMS[term] : null,
    // Handset installment and lease prices are Q's financing options, never the "monthly price" of the offer.
    ...(selected.recurring && kind !== 'device' ? { recurringPrice: selected.recurring } : {}),
    ...(selected.oneTime ? { oneTimePrice: selected.oneTime } : {}),
    ...(financed.length > 0 ? { financedPrices: financed } : {}),
    ...(typeof variant.availability?.availableQuantity === 'number' ? { availableQuantity: variant.availability.availableQuantity } : {}),
    images: (variant.images ?? []).map((image) => image.url),
    attributes: plain,
  };
}

/** One projection of a `malva-offer` product to an `Offer` without facts (see `mergeFacts`). `null` when `offer-kind` is unknown. */
export function mapOffer(projection: ProductProjection, ctx: OfferContext, locale: string = ctx.market.locale): Offer | null {
  const attrs = projection.masterVariant.attributes;
  const kind = oneOf(OFFER_KINDS, attrEnumKey(attrs, 'offer-kind'));
  const key = projection.key ?? projection.id;
  if (!kind) {
    console.warn('[catalog] offer dropped (unknown offer-kind)', key);
    return null;
  }
  const categoryKeys = (projection.categories ?? []).flatMap((category) => {
    const categoryKey = ctx.categoryIdToKey[category.id];
    return categoryKey ? [categoryKey] : [];
  });
  const variants = [projection.masterVariant, ...projection.variants].map((variant, index) => mapVariant(variant, index === 0, kind, ctx));
  const master = variants[0] as OfferVariant;
  const image = master.images[0];
  return {
    id: projection.id,
    key,
    kind,
    name: getLocalizedString(projection.name, locale),
    slug: getLocalizedString(projection.slug, locale),
    description: getLocalizedString(projection.description, locale),
    categoryKeys,
    ...(categoryKeys[0] ? { primaryCategoryKey: categoryKeys[0] } : {}),
    anchors: attrStringSet(attrs, 'anchors'),
    facts: null,
    includedOffers: attrStringSet(attrs, 'included-offers'),
    compatibleAddons: attrStringSet(attrs, 'compatible-addons'),
    compatibleEquipment: attrStringSet(attrs, 'compatible-equipment'),
    conflictsWith: attrStringSet(attrs, 'conflicts-with'),
    audience: keepAllowed(AUDIENCES, attrEnumKeys(attrs, 'audience')),
    existingCustomer: oneOf(EXISTING, attrEnumKey(attrs, 'existing-customer')) ?? 'any',
    channels: attrStringSet(attrs, 'channels'),
    ...optional({ startTime: attrDate(attrs, 'start-time'), endTime: attrDate(attrs, 'end-time') }),
    variants,
    headline: {
      ...(master.recurringPrice ? { recurring: master.recurringPrice } : {}),
      ...(master.oneTimePrice ? { oneTime: master.oneTimePrice } : {}),
      term: master.term,
      termMonths: master.termMonths,
    },
    ...(image ? { image } : {}),
  };
}

/** Attaches the anchor product's facts and unions the plan's raw references into the offer's. */
export function mergeFacts(offer: Offer, factsByKey: Readonly<Record<string, OfferFacts>>): Offer {
  const facts = offer.anchors.map((anchor) => factsByKey[anchor]).find((candidate) => candidate !== undefined) ?? null;
  const plan = facts?.kind === 'plan' ? facts : null;
  return {
    ...offer,
    facts,
    includedOffers: union(offer.includedOffers, plan?.includedAddons ?? []),
    conflictsWith: union(offer.conflictsWith, plan?.conflictsWith ?? []),
  };
}

