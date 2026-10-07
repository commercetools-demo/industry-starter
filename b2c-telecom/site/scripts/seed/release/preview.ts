// Preview: the catalog as customers would see it at an instant, computed without writing anything.
import { isOfferReleased } from '../../../lib/offers/release';
import { applyToIndex, discountEffectiveAt, endTimeOf, priceAt, startTimeOf } from './model';
import type { CatalogIndex, IndexOffer, ReleaseManifest } from './types';

export interface PreviewRow {
  key: string;
  name: string;
  usd?: number;
  eur?: number;
  start?: string;
  end?: string;
}

export interface PriceChange {
  key: string;
  field: 'usd' | 'eur';
  from?: number;
  to?: number;
}

export interface Preview {
  releaseKey: string;
  at: string;
  now: string;
  rows: PreviewRow[];
  added: string[];
  withdrawn: string[];
  priceChanges: PriceChange[];
  discountsAdded: string[];
  discountsEnded: string[];
  earlyVisible: string[];
  checklist: string[];
  rollbackNote?: string;
}

function rowOf(offer: IndexOffer, at: Date): PreviewRow | null {
  const master = offer.variants[0];
  if (!offer.published || !master) return null;
  if (!isOfferReleased({ startTime: startTimeOf(offer), endTime: endTimeOf(offer) }, at)) return null;
  const monthly = (currency: string, country: string): number | undefined => priceAt(master, currency, country, at, true) ?? priceAt(master, currency, country, at, false);
  const usd = monthly('USD', 'US');
  const eur = monthly('EUR', 'DE');
  if (usd === undefined) return null;
  const start = startTimeOf(offer);
  const end = endTimeOf(offer);
  return { key: offer.key, name: offer.name['en-US'] ?? offer.key, usd, ...(eur !== undefined ? { eur } : {}), ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

/** Offers a US customer can buy at `at`: published, inside the release window, with a valid price. */
export function purchasableAt(index: CatalogIndex, at: Date): PreviewRow[] {
  return index.offers.flatMap((offer) => {
    const row = rowOf(offer, at);
    return row ? [row] : [];
  });
}

export function previewRelease(manifest: ReleaseManifest, index: CatalogIndex, opts: { at?: Date; now?: Date } = {}): Preview {
  const now = opts.now ?? new Date();
  const at = opts.at ?? new Date(manifest.releaseAt);
  const after = applyToIndex(index, manifest);
  const rows = purchasableAt(after, at);
  const current = purchasableAt(index, now);
  const currentByKey = new Map(current.map((r) => [r.key, r]));
  const rowsByKey = new Map(rows.map((r) => [r.key, r]));
  const priceChanges: PriceChange[] = [];
  for (const row of rows) {
    const old = currentByKey.get(row.key);
    if (!old) continue;
    if (old.usd !== row.usd) priceChanges.push({ key: row.key, field: 'usd', from: old.usd, to: row.usd });
    if (old.eur !== row.eur) priceChanges.push({ key: row.key, field: 'eur', from: old.eur, to: row.eur });
  }
  const effectiveNow = new Set(index.discounts.filter((d) => discountEffectiveAt(d, now)).map((d) => d.key));
  const effectiveAt = new Set(after.discounts.filter((d) => discountEffectiveAt(d, at)).map((d) => d.key));
  const early = manifest.patchOffers.filter((p) => p.name || p.description || Object.keys(p.attributes ?? {}).length > 0).map((p) => p.key);
  return {
    releaseKey: manifest.key,
    at: at.toISOString(),
    now: now.toISOString(),
    rows,
    added: rows.filter((r) => !currentByKey.has(r.key)).map((r) => r.key),
    withdrawn: current.filter((r) => !rowsByKey.has(r.key)).map((r) => r.key),
    priceChanges,
    discountsAdded: [...effectiveAt].filter((k) => !effectiveNow.has(k)),
    discountsEnded: [...effectiveNow].filter((k) => !effectiveAt.has(k)),
    earlyVisible: early,
    checklist: manifest.externalChecklist,
    ...(manifest.rollbackOf
      ? { rollbackNote: `Rollback of ${manifest.rollbackOf}: orders already placed keep their prices; recurring orders with price mode Dynamic pick up the rolled-back catalog price on their next order.` }
      : {}),
  };
}

const money = (cents: number | undefined): string => (cents === undefined ? '-' : (cents / 100).toFixed(2));

export function renderPreview(p: Preview): string[] {
  const lines: string[] = [];
  lines.push(`Preview of ${p.releaseKey}: the catalog as customers see it at ${p.at} (now: ${p.now}). Nothing is written.`);
  lines.push(`Purchasable offers (${p.rows.length}):`);
  for (const r of p.rows) lines.push(`  ${r.key}  "${r.name}"  USD ${money(r.usd)}  EUR ${money(r.eur)}  start ${r.start ?? '-'}  end ${r.end ?? '-'}`);
  lines.push('Difference to now:');
  lines.push(`  offers added: ${p.added.join(', ') || 'none'}`);
  lines.push(`  offers withdrawn: ${p.withdrawn.join(', ') || 'none'}`);
  lines.push(`  price changes: ${p.priceChanges.map((c) => `${c.key} ${c.field.toUpperCase()} ${money(c.from)} -> ${money(c.to)}`).join('; ') || 'none'}`);
  lines.push(`  cart discounts added: ${p.discountsAdded.join(', ') || 'none'}`);
  lines.push(`  cart discounts ended: ${p.discountsEnded.join(', ') || 'none'}`);
  if (p.earlyVisible.length > 0) lines.push(`Visible before the release instant (text or attribute patches): ${p.earlyVisible.join(', ')}`);
  if (p.rollbackNote) lines.push(p.rollbackNote);
  lines.push('External checklist (not covered by the atomic boundary):');
  if (p.checklist.length === 0) lines.push('  none');
  for (const item of p.checklist) lines.push(`  - ${item}`);
  return lines;
}
