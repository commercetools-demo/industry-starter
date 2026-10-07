// `release:verify`: a scheduled release is revalidated against the CURRENT catalog (open question 3): did a referenced key vanish,
// did a conflict appear, is what the release wrote still in place?
import type { CtApi } from '../lib';
import { buildCatalogIndex } from './catalogIndex';
import { sameInstant, startTimeOf, endTimeOf } from './model';
import { getRecord } from './store';
import { errorsOf, renderIssues, validateRelease } from './validate';
import type { ReleaseRecord } from './types';

export interface RevalidateResult {
  ok: boolean;
  problems: string[];
  /** True when the release already took effect (nothing is dark any more, so nothing is revalidated). */
  effective?: boolean;
}

export async function revalidateRecord(api: CtApi, record: ReleaseRecord, now: Date): Promise<RevalidateResult> {
  if (record.status === 'applying' || record.status === 'inconsistent') {
    return { ok: false, problems: [`release ${record.key} is ${record.status}${record.inconsistentKeys ? ` (inspect: ${record.inconsistentKeys.join(', ')})` : ''}; run release:cancel`] };
  }
  if (record.status !== 'scheduled') return { ok: true, problems: [] };
  if (Date.parse(record.releaseAt) <= now.getTime()) return { ok: true, problems: [], effective: true };
  if (!record.manifest) return { ok: false, problems: [`the record of ${record.key} holds no manifest`] };
  const manifest = record.manifest;
  const index = await buildCatalogIndex(api);
  const problems = renderIssues(errorsOf(validateRelease(manifest, index, { scheduled: true, now: new Date(record.appliedAt) })));
  for (const draft of manifest.createOffers) {
    const offer = index.offers.find((o) => o.key === draft.key);
    if (!offer) problems.push(`created offer ${draft.key} is missing`);
    else if (!offer.published || !sameInstant(startTimeOf(offer), manifest.releaseAt)) problems.push(`created offer ${draft.key} no longer starts at ${manifest.releaseAt}`);
  }
  for (const key of manifest.withdrawOffers) {
    const offer = index.offers.find((o) => o.key === key);
    if (offer && !sameInstant(endTimeOf(offer), manifest.releaseAt)) problems.push(`withdrawn offer ${key} no longer ends at ${manifest.releaseAt}`);
  }
  for (const draft of manifest.createCartDiscounts) {
    const discount = index.discounts.find((d) => d.key === draft.key);
    if (!discount) problems.push(`created cart discount ${draft.key} is missing`);
    else if (!sameInstant(discount.validFrom, manifest.releaseAt)) problems.push(`created cart discount ${draft.key} no longer starts at ${manifest.releaseAt}`);
  }
  return { ok: problems.length === 0, problems };
}

export async function revalidateRelease(api: CtApi, key: string, now: Date): Promise<RevalidateResult> {
  const record = await getRecord(api, key);
  if (!record) return { ok: false, problems: [`no release record "${key}"`] };
  return revalidateRecord(api, record, now);
}
