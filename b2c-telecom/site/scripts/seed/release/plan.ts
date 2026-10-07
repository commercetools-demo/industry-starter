// Plan: the ordered write list of a release, the change list for the record, and the generated rollback manifest.
import type { PriceSpec } from '../data/catalog-types';
import type { CartDiscountDraft, ProductDraft } from '../types';
import { applyToIndex, endTimeOf, priceAt, scopeOf, startTimeOf } from './model';
import type { CatalogIndex, IndexOffer, OfferPatch, ReleaseChange, ReleaseManifest, ReleaseSnapshot, SnapPrice } from './types';

export type Step =
  | { kind: 'createDiscount'; key: string; draft: CartDiscountDraft }
  | { kind: 'withdrawDiscount'; key: string }
  | { kind: 'reinstateDiscount'; key: string }
  | { kind: 'createOffer'; key: string; draft: ProductDraft }
  | { kind: 'patchOffer'; key: string; patch: OfferPatch }
  | { kind: 'withdrawOffer'; key: string }
  | { kind: 'reinstateOffer'; key: string };

/** Write order: cart discounts, created offers, patched offers, withdrawn offers, reinstated offers (compensation runs it backwards). */
export function planRelease(manifest: ReleaseManifest): Step[] {
  return [
    ...manifest.createCartDiscounts.map((draft): Step => ({ kind: 'createDiscount', key: draft.key, draft })),
    ...manifest.withdrawCartDiscounts.map((key): Step => ({ kind: 'withdrawDiscount', key })),
    ...manifest.reinstateCartDiscounts.map((key): Step => ({ kind: 'reinstateDiscount', key })),
    ...manifest.createOffers.map((draft): Step => ({ kind: 'createOffer', key: draft.key, draft })),
    ...manifest.patchOffers.map((patch): Step => ({ kind: 'patchOffer', key: patch.key, patch })),
    ...manifest.withdrawOffers.map((key): Step => ({ kind: 'withdrawOffer', key })),
    ...manifest.reinstateOffers.map((key): Step => ({ kind: 'reinstateOffer', key })),
  ];
}

const priceField = (sku: string, p: { currencyCode: string; country?: string; recurrencePolicy?: string }): string => `${sku}/${p.currencyCode}/${p.country ?? '-'}/${p.recurrencePolicy ?? 'once'}`;

/** What the release changes, as the record stores it (offer times, price steps, discount validity). */
export function describeChanges(manifest: ReleaseManifest, index: CatalogIndex): ReleaseChange[] {
  const after = applyToIndex(index, manifest);
  const changes: ReleaseChange[] = [];
  const at = new Date(manifest.releaseAt);
  const afterOffer = (key: string): IndexOffer | undefined => after.offers.find((o) => o.key === key);
  for (const draft of manifest.createOffers) {
    const offer = afterOffer(draft.key);
    changes.push({ resource: 'offer', key: draft.key, field: 'start-time', before: null, after: offer ? startTimeOf(offer) ?? null : null });
    for (const v of offer?.variants ?? []) {
      for (const p of v.prices) changes.push({ resource: 'price', key: draft.key, field: priceField(v.sku, p), before: null, after: p.centAmount });
    }
  }
  const touched = new Set([...manifest.patchOffers.map((p) => p.key), ...manifest.withdrawOffers, ...manifest.reinstateOffers]);
  for (const key of touched) {
    const before = index.offers.find((o) => o.key === key);
    const next = afterOffer(key);
    if (!before || !next) continue;
    if (endTimeOf(before) !== endTimeOf(next)) changes.push({ resource: 'offer', key, field: 'end-time', before: endTimeOf(before) ?? null, after: endTimeOf(next) ?? null });
    const patch = manifest.patchOffers.find((p) => p.key === key);
    if (patch?.name) changes.push({ resource: 'offer', key, field: 'name', before: before.name, after: patch.name });
    if (patch?.description) changes.push({ resource: 'offer', key, field: 'description', before: before.description ?? null, after: patch.description });
    for (const [name, value] of Object.entries(patch?.attributes ?? {})) {
      changes.push({ resource: 'offer', key, field: `attribute:${name}`, before: before.variants[0]?.attributes[name] ?? null, after: value });
    }
    for (const v of next.variants) {
      const old = before.variants.find((b) => b.sku === v.sku);
      for (const p of v.prices) {
        if (old?.prices.some((o) => o.key !== undefined && o.key === p.key)) continue;
        const current = old?.prices.find((o) => scopeOf(o) === scopeOf(p) && priceAt({ sku: v.sku, attributes: {}, prices: [o] }, o.currencyCode, o.country ?? '', at, o.recurrencePolicy !== undefined) !== undefined);
        changes.push({ resource: 'price', key, field: priceField(v.sku, p), before: current?.centAmount ?? null, after: p.centAmount });
      }
    }
  }
  for (const draft of manifest.createCartDiscounts) changes.push({ resource: 'cartDiscount', key: draft.key, field: 'validFrom', before: null, after: manifest.releaseAt });
  for (const key of manifest.withdrawCartDiscounts) {
    changes.push({ resource: 'cartDiscount', key, field: 'validUntil', before: index.discounts.find((d) => d.key === key)?.validUntil ?? null, after: manifest.releaseAt });
  }
  for (const key of manifest.reinstateCartDiscounts) {
    changes.push({ resource: 'cartDiscount', key, field: 'validUntil', before: index.discounts.find((d) => d.key === key)?.validUntil ?? null, after: null });
  }
  return changes;
}

export interface RollbackOptions {
  releaseAt: string;
  expediteReason?: string;
}

function specOf(sku: string, p: SnapPrice): PriceSpec {
  return {
    currency: p.value.currencyCode as PriceSpec['currency'],
    centAmount: p.value.centAmount,
    country: p.country ?? '',
    ...(p.recurrencePolicy ? { recurrencePolicy: p.recurrencePolicy } : {}),
  };
}

/**
 * The inverse of an applied release, from its manifest and snapshot (D-057: rollback = apply the previous state as a manifest).
 * Created offers are withdrawn, withdrawn ones reinstated, patched prices go back to what the snapshot held (as new prices from the
 * rollback instant, so the price history stays), created discounts end, withdrawn ones are reinstated.
 */
export function buildRollbackManifest(applied: ReleaseManifest, snapshot: ReleaseSnapshot, opts: RollbackOptions): ReleaseManifest {
  const patchBack: OfferPatch[] = applied.patchOffers.map((patch) => {
    const snap = snapshot.offers[patch.key];
    const prices = (patch.prices ?? []).map(({ sku, prices: specs }) => {
      const scopes = new Set(specs.map((s) => scopeOf({ currencyCode: s.currency, country: s.country, recurrencePolicy: s.recurrencePolicy })));
      const old = snap?.variants.find((v) => v.sku === sku)?.prices ?? [];
      const open = old.filter((p) => scopes.has(scopeOf({ currencyCode: p.value.currencyCode, country: p.country, recurrencePolicy: p.recurrencePolicy })) && (p.validUntil === undefined || Date.parse(p.validUntil) > Date.parse(applied.releaseAt)));
      return { sku, prices: open.map((p) => specOf(sku, p)) };
    });
    return {
      key: patch.key,
      ...(patch.name && snap ? { name: snap.name } : {}),
      ...(patch.description && snap?.description ? { description: snap.description } : {}),
      ...(patch.attributes && snap ? { attributes: Object.fromEntries(Object.keys(patch.attributes).map((n) => [n, snap.attributes[n]])) } : {}),
      ...(prices.length > 0 ? { prices } : {}),
    };
  });
  const key = `${applied.key}-rollback`.slice(0, 'malva-rel-'.length + 60);
  return {
    schema: 1,
    key,
    name: `Rollback of ${applied.name}`,
    author: applied.author,
    releaseAt: opts.releaseAt,
    createOffers: [],
    patchOffers: patchBack,
    withdrawOffers: [...applied.createOffers.map((o) => o.key), ...applied.reinstateOffers],
    reinstateOffers: [...applied.withdrawOffers],
    replaces: [],
    createCartDiscounts: [],
    withdrawCartDiscounts: [...applied.createCartDiscounts.map((d) => d.key), ...applied.reinstateCartDiscounts],
    reinstateCartDiscounts: [...applied.withdrawCartDiscounts],
    externalChecklist: applied.externalChecklist.map((item) => `Revert: ${item}`),
    ...(opts.expediteReason ? { expedite: { reason: opts.expediteReason } } : {}),
    rollbackOf: applied.key,
  };
}
