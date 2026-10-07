// Validation phase of a release: pure over a CatalogIndex, zero writes. Every issue has a code and names the key.
import type { PriceSpec } from '../data/catalog-types';
import type { ProductDraft } from '../types';
import { applyPricePatch, applyToIndex, stripCreated, draftVariants, endTimeOf, priceAt, startTimeOf, END_TIME, START_TIME, scopeOf } from './model';
import { RELEASE_MAX_AHEAD_DAYS, type CatalogIndex, type Issue, type OfferPatch, type ReleaseManifest } from './types';

export interface ValidateOptions {
  now?: Date;
  /**
   * Revalidating a release that is already applied (`release:verify`, `seed:verify`): what the release created is taken out of
   * the index first, and the "future instant" and price-patch rules do not apply (the patches are already in the index).
   */
  scheduled?: boolean;
}

const LOCALES = ['en-US', 'de-DE'] as const;
const SET_ATTRIBUTES = ['included-offers', 'conflicts-with', 'compatible-addons', 'compatible-equipment'] as const;
const RECURRING_CHARGES = ['monthly', 'monthly-rental'];
const MARKETS: { currency: string; country: string }[] = [
  { currency: 'USD', country: 'US' },
  { currency: 'EUR', country: 'DE' },
];

const listOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

function predicateTexts(record: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (typeof record.cartPredicate === 'string') out.push(record.cartPredicate);
  const target = record.target as { predicate?: unknown; triggerPattern?: unknown; targetPattern?: unknown } | undefined;
  if (target) {
    if (typeof target.predicate === 'string') out.push(target.predicate);
    for (const pattern of [target.triggerPattern, target.targetPattern]) {
      if (Array.isArray(pattern)) for (const p of pattern as { predicate?: unknown }[]) if (typeof p.predicate === 'string') out.push(p.predicate);
    }
  }
  return out;
}

export function attributesInPredicate(predicate: string): string[] {
  const names = new Set<string>();
  for (const m of predicate.matchAll(/attributes\.(?:`([^`]+)`|([A-Za-z0-9_-]+))/g)) names.add(m[1] ?? m[2] ?? '');
  return [...names];
}

export function validateRelease(manifest: ReleaseManifest, rawIndex: CatalogIndex, opts: ValidateOptions = {}): Issue[] {
  const index = opts.scheduled ? stripCreated(rawIndex, manifest) : rawIndex;
  const issues: Issue[] = [];
  const now = opts.now ?? new Date();
  const error = (code: string, key: string, message: string): void => void issues.push({ code, key, message, severity: 'error' });
  const warn = (code: string, key: string, message: string): void => void issues.push({ code, key, message, severity: 'warning' });

  const existing = new Set(index.offers.map((o) => o.key));
  const createdKeys = manifest.createOffers.map((o) => o.key);
  const created = new Set(createdKeys);
  const allOffers = new Set([...existing, ...created]);
  const productKeys = new Set(index.productKeys);
  const discountKeys = new Set(index.discounts.map((d) => d.key));
  const releaseMs = Date.parse(manifest.releaseAt);

  // --- rule 1: DANGLING_KEY ------------------------------------------------------------------------------------
  const mustExist = (field: string, keys: string[]): void => {
    for (const key of keys) if (!existing.has(key)) error('DANGLING_KEY', key, `${field} names an offer that does not exist`);
  };
  mustExist('withdrawOffers', manifest.withdrawOffers);
  mustExist('reinstateOffers', manifest.reinstateOffers);
  mustExist('patchOffers', manifest.patchOffers.map((p) => p.key));
  for (const key of manifest.withdrawCartDiscounts) if (!discountKeys.has(key)) error('DANGLING_KEY', key, 'withdrawCartDiscounts names a cart discount that does not exist');
  for (const key of manifest.reinstateCartDiscounts) if (!discountKeys.has(key)) error('DANGLING_KEY', key, 'reinstateCartDiscounts names a cart discount that does not exist');
  for (const pair of manifest.replaces) {
    if (!existing.has(pair.old)) error('DANGLING_KEY', pair.old, 'replaces.old names an offer that does not exist');
  }
  for (const draft of manifest.createOffers) {
    for (const variant of draftVariants(draft)) {
      const attr = (name: string): unknown => variant.attributes.find((a) => a.name === name)?.value;
      for (const name of SET_ATTRIBUTES) {
        for (const key of listOf(attr(name))) if (!allOffers.has(key)) error('DANGLING_KEY', key, `${draft.key}: ${name} names an offer that does not exist`);
      }
      for (const key of listOf(attr('anchors'))) if (!productKeys.has(key)) error('DANGLING_KEY', key, `${draft.key}: anchors names a product that does not exist`);
      for (const price of variant.prices) {
        if (price.recurrencePolicy && !index.recurrencePolicies.includes(price.recurrencePolicy)) error('DANGLING_KEY', price.recurrencePolicy, `${draft.key}: price names a recurrence policy that does not exist`);
      }
    }
    for (const key of draft.categories) if (!index.categories.includes(key)) error('DANGLING_KEY', key, `${draft.key}: category does not exist`);
    if (!index.taxCategories.includes(draft.taxCategory)) error('DANGLING_KEY', draft.taxCategory, `${draft.key}: tax category does not exist`);
  }
  for (const patch of manifest.patchOffers) {
    const offer = index.offers.find((o) => o.key === patch.key);
    for (const { sku, prices } of patch.prices ?? []) {
      if (offer && !offer.variants.some((v) => v.sku === sku)) error('DANGLING_KEY', sku, `${patch.key}: SKU does not exist on this offer`);
      for (const spec of prices) {
        if (spec.recurrencePolicy && !index.recurrencePolicies.includes(spec.recurrencePolicy)) error('DANGLING_KEY', spec.recurrencePolicy, `${patch.key}: price names a recurrence policy that does not exist`);
      }
    }
  }

  // --- rule 3: REPLACES_MISMATCH --------------------------------------------------------------------------------
  for (const pair of manifest.replaces) {
    if (!manifest.withdrawOffers.includes(pair.old)) error('REPLACES_MISMATCH', pair.old, `replaces: "${pair.old}" must be listed in withdrawOffers`);
    if (!created.has(pair.new)) {
      error('REPLACES_MISMATCH', pair.new, `replaces: "${pair.new}" must be listed in createOffers`);
      continue;
    }
    const draft = manifest.createOffers.find((o) => o.key === pair.new) as ProductDraft;
    const declared = draftVariants(draft)
      .map((v) => v.attributes.find((a) => a.name === START_TIME)?.value)
      .find((value) => typeof value === 'string') as string | undefined;
    if (declared !== undefined && Date.parse(declared) !== releaseMs) {
      error('REPLACES_MISMATCH', pair.new, `replaces: the old offer ends at ${manifest.releaseAt} but "${pair.new}" declares start-time ${declared}`);
    }
    const old = index.offers.find((o) => o.key === pair.old);
    const oldEnd = old ? endTimeOf(old) : undefined;
    if (!opts.scheduled && oldEnd !== undefined && Date.parse(oldEnd) < releaseMs) error('REPLACES_MISMATCH', pair.old, `replaces: "${pair.old}" already ended at ${oldEnd}, before ${manifest.releaseAt}`);
  }

  // --- rule 2: CONFLICT -----------------------------------------------------------------------------------------
  for (const key of manifest.withdrawOffers) if (manifest.reinstateOffers.includes(key)) error('CONFLICT', key, 'listed in both withdrawOffers and reinstateOffers');
  const after = applyToIndex(index, manifest);
  const withdrawn = new Set(manifest.withdrawOffers.filter((k) => !manifest.reinstateOffers.includes(k)));
  const resulting = after.offers.filter((o) => !withdrawn.has(o.key));
  const resultingByKey = new Map(resulting.map((o) => [o.key, o]));
  const touched = new Set([...created, ...manifest.patchOffers.map((p) => p.key)]);
  const relation = (key: string, name: string): string[] => listOf(resultingByKey.get(key)?.variants[0]?.attributes[name]);
  const replacedOld = new Set(manifest.replaces.map((p) => p.old));
  for (const offer of resulting) {
    const conflicts = relation(offer.key, 'conflicts-with');
    const included = relation(offer.key, 'included-offers');
    for (const other of conflicts) {
      if (included.includes(other)) error('CONFLICT', offer.key, `lists "${other}" in both included-offers and conflicts-with`);
      if (resultingByKey.has(other) && (touched.has(offer.key) || touched.has(other)) && !relation(other, 'conflicts-with').includes(offer.key)) {
        error('CONFLICT', offer.key, `conflicts-with "${other}" is not symmetric: "${other}" does not list "${offer.key}"`);
      }
    }
    if (touched.has(offer.key) || manifest.withdrawOffers.length > 0) {
      for (const name of ['included-offers', 'compatible-addons', 'compatible-equipment']) {
        for (const other of relation(offer.key, name)) {
          if (withdrawn.has(other) && !replacedOld.has(other)) error('CONFLICT', offer.key, `${name} lists "${other}", which this release withdraws without a replacement`);
        }
      }
    }
  }

  // --- rule 4: duplicates, locales, prices ----------------------------------------------------------------------
  const skuSeen = new Set<string>();
  const priceKeySeen = new Set<string>();
  const knownSkus = new Set(index.skus);
  const knownPriceKeys = new Set(index.priceKeys);
  const hasLocales = (value: Record<string, string> | undefined): boolean => !!value && LOCALES.every((l) => typeof value[l] === 'string' && value[l] !== '');
  for (const draft of manifest.createOffers) {
    if (productKeys.has(draft.key)) error('DUPLICATE_KEY', draft.key, 'a product with this key already exists');
    if (draft.productType !== 'malva-offer') error('FORBIDDEN_RESOURCE', draft.key, `a release creates offers (productType malva-offer) only, not "${draft.productType}"`);
    if (!hasLocales(draft.name)) error('MISSING_LOCALE', draft.key, 'name needs en-US and de-DE');
    if (!hasLocales(draft.slug)) error('MISSING_LOCALE', draft.key, 'slug needs en-US and de-DE');
    if (draft.description && !hasLocales(draft.description)) error('MISSING_LOCALE', draft.key, 'description needs en-US and de-DE');
    for (const variant of draftVariants(draft)) {
      if (knownSkus.has(variant.sku) || skuSeen.has(variant.sku)) error('DUPLICATE_SKU', variant.sku, `${draft.key}: SKU is already used`);
      skuSeen.add(variant.sku);
      for (const price of variant.prices) {
        if (price.key && (knownPriceKeys.has(price.key) || priceKeySeen.has(price.key))) error('DUPLICATE_PRICE_KEY', price.key, `${draft.key}: price key is already used`);
        if (price.key) priceKeySeen.add(price.key);
        if (price.value.centAmount <= 0) error('PRICE_NOT_POSITIVE', variant.sku, `${draft.key}: price ${price.value.currencyCode} ${price.value.centAmount} must be greater than 0`);
      }
      for (const m of MARKETS) {
        if (!variant.prices.some((p) => p.value.currencyCode === m.currency && p.country === m.country)) error('MISSING_PRICE', variant.sku, `${draft.key}: no ${m.currency}/${m.country} price`);
      }
      const charge = variant.attributes.find((a) => a.name === 'charge-type')?.value;
      if (typeof charge === 'string' && RECURRING_CHARGES.includes(charge)) {
        for (const m of MARKETS) {
          if (!variant.prices.some((p) => p.value.currencyCode === m.currency && p.recurrencePolicy)) error('MISSING_PRICE', variant.sku, `${draft.key}: recurring variant has no ${m.currency} price tied to a recurrence policy`);
        }
      }
    }
  }
  for (const patch of manifest.patchOffers) validatePatch(patch);
  function validatePatch(patch: OfferPatch): void {
    const offer = index.offers.find((o) => o.key === patch.key);
    if (patch.name && !hasLocales(patch.name)) error('MISSING_LOCALE', patch.key, 'patched name needs en-US and de-DE');
    if (patch.description && !hasLocales(patch.description)) error('MISSING_LOCALE', patch.key, 'patched description needs en-US and de-DE');
    if (patch.name || patch.description || (patch.attributes && Object.keys(patch.attributes).length > 0)) {
      warn('EARLY_VISIBLE_PATCH', patch.key, 'text and attribute patches are applied at apply time and are visible before releaseAt; use a new offer for anything customer-visible');
    }
    for (const name of Object.keys(patch.attributes ?? {})) {
      if (name === START_TIME || name === END_TIME) error('TIME', patch.key, `${name} is set by the release engine and cannot be patched`);
    }
    for (const { sku, prices } of patch.prices ?? []) {
      const variant = offer?.variants.find((v) => v.sku === sku);
      if (!variant) continue;
      checkPatchPrices(patch.key, sku, prices, variant.prices);
    }
  }
  function checkPatchPrices(offerKey: string, sku: string, specs: PriceSpec[], current: CatalogIndex['offers'][number]['variants'][number]['prices']): void {
    for (const spec of specs) {
      if (spec.centAmount <= 0) error('PRICE_NOT_POSITIVE', sku, `${offerKey}: price ${spec.currency} ${spec.centAmount} must be greater than 0`);
      const clash = current.find((p) => scopeOf(p) === scopeOf({ currencyCode: spec.currency, country: spec.country, recurrencePolicy: spec.recurrencePolicy }) && p.validFrom && Date.parse(p.validFrom) >= releaseMs);
      if (clash && !opts.scheduled) error('PRICE_OVERLAP', sku, `${offerKey}: a ${spec.currency}/${spec.country} price already starts at ${clash.validFrom} (another release is pending)`);
    }
    if (opts.scheduled) return;
    const resulting = specs.length > 0 ? applyPricePatch(current, sku, specs, manifest.releaseAt, manifest.endsAt) : current;
    for (const m of MARKETS) {
      const at = new Date(releaseMs);
      const hasRecurring = priceAt({ sku, attributes: {}, prices: resulting }, m.currency, m.country, at, true) !== undefined;
      const hasOnce = priceAt({ sku, attributes: {}, prices: resulting }, m.currency, m.country, at, false) !== undefined;
      if (!hasRecurring && !hasOnce) error('MISSING_PRICE', sku, `${offerKey}: no ${m.currency}/${m.country} price in effect at ${manifest.releaseAt} after the patch`);
    }
    for (const p of resulting) {
      if (p.key && !current.some((c) => c.key === p.key) && (knownPriceKeys.has(p.key) || priceKeySeen.has(p.key))) error('DUPLICATE_PRICE_KEY', p.key, `${offerKey}: price key is already used`);
      if (p.key) priceKeySeen.add(p.key);
    }
  }
  const sortSeen = new Set<string>();
  for (const draft of manifest.createCartDiscounts) {
    if (discountKeys.has(draft.key)) error('DUPLICATE_KEY', draft.key, 'a cart discount with this key already exists');
    const used = index.discounts.find((d) => d.sortOrder === draft.sortOrder && d.key !== draft.key);
    if (used || sortSeen.has(draft.sortOrder)) error('SORT_ORDER_USED', draft.key, `sortOrder "${draft.sortOrder}" is already used${used ? ` by "${used.key}"` : ' in this release'}`);
    sortSeen.add(draft.sortOrder);
    for (const locale of LOCALES) if (!draft.name[locale]) error('MISSING_LOCALE', draft.key, `discount name needs ${locale}`);
    // --- rule 7: PREDICATE_ATTRIBUTE
    if (index.lineItemAttributes.length > 0) {
      for (const predicate of predicateTexts(draft as unknown as Record<string, unknown>)) {
        for (const name of attributesInPredicate(predicate)) {
          if (!index.lineItemAttributes.includes(name)) error('PREDICATE_ATTRIBUTE', draft.key, `predicate reads attribute "${name}", which is not saved to the line item (savedToLineItem)`);
        }
      }
    }
  }

  // --- rule 5: TIME -------------------------------------------------------------------------------------------
  if (!opts.scheduled) {
    if (releaseMs <= now.getTime()) error('TIME', manifest.key, `releaseAt ${manifest.releaseAt} must be in the future`);
    if (releaseMs > now.getTime() + RELEASE_MAX_AHEAD_DAYS * 24 * 3600 * 1000) error('TIME', manifest.key, `releaseAt ${manifest.releaseAt} is more than ${RELEASE_MAX_AHEAD_DAYS} days ahead`);
  }
  if (manifest.endsAt !== undefined && Date.parse(manifest.endsAt) <= releaseMs) error('TIME', manifest.key, 'endsAt must be later than releaseAt');
  for (const key of [...manifest.withdrawOffers, ...manifest.reinstateOffers, ...manifest.patchOffers.map((p) => p.key)]) {
    const offer = index.offers.find((o) => o.key === key);
    const start = offer ? startTimeOf(offer) : undefined;
    if (start !== undefined && Date.parse(start) > releaseMs) error('TIME', key, `the offer starts at ${start}, later than this release (${manifest.releaseAt})`);
  }
  for (const draft of manifest.createOffers) {
    for (const variant of draftVariants(draft)) {
      for (const name of [START_TIME, END_TIME]) {
        const declared = variant.attributes.find((a) => a.name === name)?.value;
        const forced = name === START_TIME ? manifest.releaseAt : manifest.endsAt;
        if (declared !== undefined && (forced === undefined || Date.parse(String(declared)) !== Date.parse(forced))) {
          error('TIME', draft.key, `${name} ${String(declared)} differs from the release (${name === START_TIME ? 'releaseAt' : 'endsAt'}); the engine sets it`);
        }
      }
    }
  }
  return issues;
}

export const errorsOf = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === 'error');

export function renderIssues(issues: Issue[]): string[] {
  return issues.map((i) => `${i.severity === 'error' ? 'ERROR' : 'WARN '} ${i.code} ${i.key}: ${i.message}`);
}
