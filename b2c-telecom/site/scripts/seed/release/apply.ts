// Apply protocol of a release (D-057): validate, snapshot, record, ordered writes, verify, record; compensation on any failure.
// Every write goes through F's CtApi and is idempotent by key. Everything written is "dark" (inert until releaseAt).
import { EXIT } from '../config';
import { CtHttpError, type CtApi } from '../lib';
import { newCtx } from '../reconcile';
import { productReconciler, unpublishAndDelete } from '../reconcilers/product';
import { deepEqual, type UpdateAction } from '../reconcilers/util';
import { buildCatalogIndex, readOffer } from './catalogIndex';
import { sha256OfManifest } from './parse';
import {
  END_TIME,
  START_TIME,
  applyPricePatch,
  applyToIndex,
  closePrices,
  darkDiscount,
  darkOffer,
  fromSnapPrice,
  priceBody,
  reopenPrices,
  sameInstant,
  toSnapPrice,
} from './model';
import { describeChanges, planRelease, type Step } from './plan';
import { takeSnapshot } from './snapshot';
import { getRecord, putRecord } from './store';
import {
  EXIT_INCONSISTENT,
  EXPEDITE_REASON_MIN_LENGTH,
  RELEASE_EXPEDITED_LEAD_MS,
  RELEASE_MIN_LEAD_MS,
  type CatalogIndex,
  type IndexOffer,
  type OfferSnapshot,
  type ReleaseManifest,
  type ReleaseRecord,
  type ReleaseSnapshot,
  type ReleaseStatus,
} from './types';
import { errorsOf, renderIssues, validateRelease } from './validate';

export type Log = (line: string) => void;

export interface ApplyDeps {
  api: CtApi;
  log: Log;
  operator: string;
  /** `--ack`: the external checklist was done. */
  ack?: boolean;
  /** Test and live-test hook: throw after the n-th write step. */
  failAfter?: number;
  now?: () => Date;
  /** Writes `.state/<key>.before.json` (injected so unit tests stay off the disk). */
  writeState?: (key: string, snapshot: ReleaseSnapshot) => void;
}

export interface Outcome {
  exitCode: number;
  status: ReleaseStatus | 'noop' | 'refused';
  record?: ReleaseRecord;
}

const refused = (log: Log, message: string): Outcome => {
  log(message);
  return { exitCode: EXIT.PREFLIGHT, status: 'refused' };
};

// ---------------------------------------------------------------------------------------------------------------
// version-safe writes

async function mutate(api: CtApi, collection: string, key: string, actions: UpdateAction[]): Promise<void> {
  if (actions.length === 0) return;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = (await api.get(`${collection}/key=${key}`)) as { version: number } | null;
    if (!existing) throw new CtHttpError(404, `${collection} "${key}" not found`, 'ResourceNotFound');
    try {
      await api.post(`${collection}/key=${key}`, { version: existing.version, actions });
      return;
    } catch (err) {
      last = err;
      if (!(err instanceof CtHttpError && err.statusCode === 409)) throw err;
    }
  }
  throw last;
}

const setAttr = (name: string, value: unknown): UpdateAction => ({ action: 'setAttributeInAllVariants', name, ...(value !== undefined ? { value } : {}) });

function priceActions(offer: IndexOffer, change: (prices: IndexOffer['variants'][number]['prices'], sku: string) => IndexOffer['variants'][number]['prices']): UpdateAction[] {
  const actions: UpdateAction[] = [];
  for (const v of offer.variants) {
    const next = change(v.prices, v.sku);
    if (!deepEqual(next, v.prices)) actions.push({ action: 'setPrices', sku: v.sku, prices: next.map(priceBody) });
  }
  return actions;
}

async function runStep(api: CtApi, step: Step, manifest: ReleaseManifest, index: CatalogIndex): Promise<void> {
  const { releaseAt, endsAt } = manifest;
  const offer = index.offers.find((o) => o.key === step.key);
  switch (step.kind) {
    case 'createDiscount':
      await api.post('cart-discounts', darkDiscount(step.draft, releaseAt, endsAt));
      return;
    case 'withdrawDiscount': {
      const current = index.discounts.find((d) => d.key === step.key);
      await mutate(api, 'cart-discounts', step.key, [{ action: 'setValidFromAndUntil', ...(current?.validFrom ? { validFrom: current.validFrom } : {}), validUntil: releaseAt }]);
      return;
    }
    case 'reinstateDiscount': {
      const current = index.discounts.find((d) => d.key === step.key);
      await mutate(api, 'cart-discounts', step.key, [{ action: 'setValidFromAndUntil', ...(current?.validFrom ? { validFrom: current.validFrom } : {}) }]);
      return;
    }
    case 'createOffer':
      await productReconciler.create(api, darkOffer(step.draft, releaseAt, endsAt), newCtx());
      return;
    case 'patchOffer': {
      if (!offer) throw new Error(`offer ${step.key} vanished`);
      const { patch } = step;
      const actions: UpdateAction[] = [];
      if (patch.name) actions.push({ action: 'changeName', name: patch.name });
      if (patch.description) actions.push({ action: 'setDescription', description: patch.description });
      for (const [name, value] of Object.entries(patch.attributes ?? {})) actions.push(setAttr(name, value));
      for (const { sku, prices } of patch.prices ?? []) {
        const variant = offer.variants.find((v) => v.sku === sku);
        if (variant) actions.push({ action: 'setPrices', sku, prices: applyPricePatch(variant.prices, sku, prices, releaseAt, endsAt).map(priceBody) });
      }
      await mutate(api, 'products', step.key, [...actions, { action: 'publish' }]);
      return;
    }
    case 'withdrawOffer': {
      if (!offer) throw new Error(`offer ${step.key} vanished`);
      await mutate(api, 'products', step.key, [setAttr(END_TIME, releaseAt), ...priceActions(offer, (prices) => closePrices(prices, releaseAt)), { action: 'publish' }]);
      return;
    }
    case 'reinstateOffer': {
      if (!offer) throw new Error(`offer ${step.key} vanished`);
      await mutate(api, 'products', step.key, [setAttr(END_TIME, undefined), ...priceActions(offer, (prices) => reopenPrices(prices, releaseAt, endsAt)), { action: 'publish' }]);
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// compensation: restore the snapshot (idempotent; works from any partial state)

const canon = (prices: IndexOffer['variants'][number]['prices']): string[] => prices.map((p) => JSON.stringify(toSnapPrice(p), Object.keys(toSnapPrice(p)).sort())).sort();

async function restoreOffer(api: CtApi, key: string, snap: OfferSnapshot): Promise<void> {
  const current = await readOffer(api, key);
  if (!current) return;
  const actions: UpdateAction[] = [];
  if (!deepEqual(current.name, snap.name)) actions.push({ action: 'changeName', name: snap.name });
  if (!deepEqual(current.description, snap.description)) actions.push({ action: 'setDescription', ...(snap.description ? { description: snap.description } : {}) });
  const master = current.variants[0];
  const wanted: Record<string, unknown> = { ...snap.attributes, [START_TIME]: snap.startTime, [END_TIME]: snap.endTime };
  for (const [name, value] of Object.entries(wanted)) {
    const have = master?.attributes[name];
    const same = typeof value === 'string' && typeof have === 'string' ? sameInstant(have, value) : deepEqual(have, value);
    if (!same) actions.push(setAttr(name, value));
  }
  for (const v of snap.variants) {
    const now = current.variants.find((c) => c.sku === v.sku);
    if (now && JSON.stringify(canon(now.prices)) !== JSON.stringify(canon(v.prices.map(fromSnapPrice)))) {
      actions.push({ action: 'setPrices', sku: v.sku, prices: v.prices.map(fromSnapPrice).map(priceBody) });
    }
  }
  if (actions.length > 0) await mutate(api, 'products', key, [...actions, { action: 'publish' }]);
}

async function restoreDiscount(api: CtApi, key: string, snap: ReleaseSnapshot['discounts'][string]): Promise<void> {
  const current = (await api.get(`cart-discounts/key=${key}`)) as { validFrom?: string; validUntil?: string; isActive?: boolean } | null;
  if (!current) return;
  const actions: UpdateAction[] = [];
  if (!sameInstant(current.validFrom, snap.validFrom) || !sameInstant(current.validUntil, snap.validUntil)) {
    actions.push({ action: 'setValidFromAndUntil', ...(snap.validFrom ? { validFrom: snap.validFrom } : {}), ...(snap.validUntil ? { validUntil: snap.validUntil } : {}) });
  }
  if (current.isActive !== snap.isActive) actions.push({ action: 'changeIsActive', isActive: snap.isActive });
  await mutate(api, 'cart-discounts', key, actions);
}

async function deleteOffer(api: CtApi, key: string): Promise<void> {
  const existing = (await api.get(`products/key=${key}`)) as { id: string; key: string; version: number } | null;
  if (existing) await unpublishAndDelete(api, existing);
}

async function deleteDiscount(api: CtApi, key: string): Promise<void> {
  const existing = (await api.get(`cart-discounts/key=${key}`)) as { version: number } | null;
  if (existing) await api.del(`cart-discounts/key=${key}`, { version: existing.version });
}

/** Restores the snapshot in reverse write order, each part retried 3 times with re-fetched versions. Returns the keys that could not be restored. */
export async function compensate(api: CtApi, snapshot: ReleaseSnapshot, log: Log): Promise<string[]> {
  const failed: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>): Promise<void> => {
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        await fn();
        return;
      } catch (err) {
        last = err;
      }
    }
    failed.push(label);
    log(`compensation failed for ${label}: ${last instanceof Error ? last.message : String(last)}`);
  };
  for (const [key, snap] of Object.entries(snapshot.offers).reverse()) await attempt(key, () => restoreOffer(api, key, snap));
  for (const key of [...snapshot.createdOffers].reverse()) await attempt(key, () => deleteOffer(api, key));
  for (const [key, snap] of Object.entries(snapshot.discounts).reverse()) await attempt(key, () => restoreDiscount(api, key, snap));
  for (const key of [...snapshot.createdDiscounts].reverse()) await attempt(key, () => deleteDiscount(api, key));
  return failed;
}

// ---------------------------------------------------------------------------------------------------------------
// verification of the written state

const instantOf = (value: string | undefined): number | null => (value === undefined ? null : Date.parse(value));

function offerShape(offer: IndexOffer): unknown {
  const master = offer.variants[0];
  return {
    published: offer.published,
    start: instantOf(typeof master?.attributes[START_TIME] === 'string' ? (master.attributes[START_TIME] as string) : undefined),
    end: instantOf(typeof master?.attributes[END_TIME] === 'string' ? (master.attributes[END_TIME] as string) : undefined),
    variants: offer.variants
      .map((v) => ({
        sku: v.sku,
        prices: v.prices
          .map((p) => [p.key ?? '', p.currencyCode, p.centAmount, p.country ?? '', p.recurrencePolicy ?? '', instantOf(p.validFrom), instantOf(p.validUntil)].join('|'))
          .sort(),
      }))
      .sort((a, b) => (a.sku < b.sku ? -1 : 1)),
  };
}

/** Pure: what a re-read of the project must look like, compared with what it does look like, for every key the release touches. */
export function verifyApplied(expected: CatalogIndex, actual: CatalogIndex, manifest: ReleaseManifest): string[] {
  const problems: string[] = [];
  const offerKeys = new Set([...manifest.createOffers.map((o) => o.key), ...manifest.patchOffers.map((p) => p.key), ...manifest.withdrawOffers, ...manifest.reinstateOffers]);
  for (const key of offerKeys) {
    const want = expected.offers.find((o) => o.key === key);
    const have = actual.offers.find((o) => o.key === key);
    if (!have) problems.push(`offer ${key} is missing`);
    else if (want && !deepEqual(offerShape(want), offerShape(have))) problems.push(`offer ${key} does not have the expected release times or prices`);
  }
  const discountKeys = new Set([...manifest.createCartDiscounts.map((d) => d.key), ...manifest.withdrawCartDiscounts, ...manifest.reinstateCartDiscounts]);
  for (const key of discountKeys) {
    const want = expected.discounts.find((d) => d.key === key);
    const have = actual.discounts.find((d) => d.key === key);
    if (!have) problems.push(`cart discount ${key} is missing`);
    else if (want && (!sameInstant(want.validFrom, have.validFrom) || !sameInstant(want.validUntil, have.validUntil) || want.isActive !== have.isActive)) {
      problems.push(`cart discount ${key} does not have the expected validity`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// apply

function baseRecord(manifest: ReleaseManifest, deps: ApplyDeps, now: Date): Omit<ReleaseRecord, 'status' | 'changes' | 'before'> {
  return {
    key: manifest.key,
    name: manifest.name,
    author: manifest.author,
    appliedBy: deps.operator,
    appliedAt: now.toISOString(),
    releaseAt: manifest.releaseAt,
    ...(manifest.endsAt ? { endsAt: manifest.endsAt } : {}),
    manifestSha256: sha256OfManifest(manifest),
    expedited: manifest.expedite !== undefined,
    ...(manifest.expedite ? { expediteReason: manifest.expedite.reason } : {}),
    externalAck: deps.ack === true,
    ...(manifest.rollbackOf ? { rollbackOf: manifest.rollbackOf } : {}),
    manifest,
  };
}

export async function applyRelease(manifest: ReleaseManifest, deps: ApplyDeps): Promise<Outcome> {
  const { api, log } = deps;
  const clock = deps.now ?? (() => new Date());
  const hash = sha256OfManifest(manifest);

  const previous = await getRecord(api, manifest.key);
  if (previous) {
    if (previous.status === 'scheduled' && previous.manifestSha256 === hash) {
      log(`Release ${manifest.key} is already scheduled for ${previous.releaseAt}. Nothing changed.`);
      return { exitCode: EXIT.OK, status: 'noop', record: previous };
    }
    if (previous.status === 'scheduled' || previous.status === 'applying' || previous.status === 'inconsistent') {
      return refused(log, `Release key ${manifest.key} is ${previous.status} with another content. Run release:cancel ${manifest.key} first, or use a new key. Nothing was written.`);
    }
  }

  const now = clock();
  const lead = manifest.expedite ? RELEASE_EXPEDITED_LEAD_MS : RELEASE_MIN_LEAD_MS;
  if (manifest.expedite && manifest.expedite.reason.trim().length < EXPEDITE_REASON_MIN_LENGTH) {
    return refused(log, `EXPEDITE_REASON: expedite.reason needs at least ${EXPEDITE_REASON_MIN_LENGTH} characters. Nothing was written.`);
  }
  if (Date.parse(manifest.releaseAt) - now.getTime() < lead) {
    return refused(
      log,
      `LEAD_TIME: releaseAt ${manifest.releaseAt} is less than ${lead / 60000} minutes away${manifest.expedite ? '' : ' (add expedite.reason to the manifest for a 2 minute minimum)'}. Nothing was written.`,
    );
  }
  if (manifest.externalChecklist.length > 0 && !deps.ack) {
    return refused(log, `The external checklist needs --ack (confirm these are done): ${manifest.externalChecklist.join('; ')}. Nothing was written.`);
  }

  const index = await buildCatalogIndex(api);
  const issues = validateRelease(manifest, index, { now });
  for (const line of renderIssues(issues)) log(line);
  if (errorsOf(issues).length > 0) {
    log(`${errorsOf(issues).length} validation error(s); nothing was written.`);
    return { exitCode: EXIT.PREFLIGHT, status: 'refused' };
  }

  const snapshot = takeSnapshot(manifest, index);
  const changes = describeChanges(manifest, index);
  deps.writeState?.(manifest.key, snapshot);
  const record: ReleaseRecord = { ...baseRecord(manifest, deps, now), status: 'applying', changes, before: snapshot };
  await putRecord(api, record);

  let done = 0;
  try {
    for (const step of planRelease(manifest)) {
      await runStep(api, step, manifest, index);
      done += 1;
      log(`  ${step.kind} ${step.key}`);
      if (deps.failAfter !== undefined && done >= deps.failAfter) throw new Error(`simulated failure after write ${done} (--fail-after)`);
    }
    const problems = verifyApplied(applyToIndex(index, manifest), await buildCatalogIndex(api), manifest);
    if (problems.length > 0) throw new Error(`verification failed: ${problems.join('; ')}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Apply failed: ${message}. Restoring the pre-apply state.`);
    const failed = await compensate(api, snapshot, log);
    if (failed.length > 0) {
      const bad: ReleaseRecord = { ...record, status: 'inconsistent', error: message, inconsistentKeys: failed };
      await putRecord(api, bad);
      log(`INCONSISTENT: could not restore ${failed.join(', ')}. Inspect them with: npm run release:verify -- ${manifest.key}`);
      return { exitCode: EXIT_INCONSISTENT, status: 'inconsistent', record: bad };
    }
    const rolled: ReleaseRecord = { ...record, status: 'rolled-back', error: message };
    await putRecord(api, rolled);
    return { exitCode: EXIT.FAILED, status: 'rolled-back', record: rolled };
  }
  const scheduled: ReleaseRecord = { ...record, status: 'scheduled', appliedAt: clock().toISOString() };
  await putRecord(api, scheduled);
  log(`Release ${manifest.key} scheduled for ${manifest.releaseAt}. Nothing is purchasable before that instant.`);
  return { exitCode: EXIT.OK, status: 'scheduled', record: scheduled };
}

/** Cancel: only before releaseAt for a scheduled release; restores the snapshot, deletes what the release created. */
export async function cancelRelease(key: string, deps: ApplyDeps): Promise<Outcome> {
  const { api, log } = deps;
  const record = await getRecord(api, key);
  if (!record) return refused(log, `No release record "${key}".`);
  if (record.status === 'withdrawn' || record.status === 'rolled-back') {
    log(`Release ${key} is already ${record.status}. Nothing changed.`);
    return { exitCode: EXIT.OK, status: 'noop', record };
  }
  const now = (deps.now ?? (() => new Date()))();
  if (record.status === 'scheduled' && Date.parse(record.releaseAt) <= now.getTime()) {
    return refused(log, `Release ${key} took effect at ${record.releaseAt}; it cannot be cancelled. Use: npm run release:rollback -- ${key}`);
  }
  const failed = await compensate(api, record.before as ReleaseSnapshot, log);
  if (failed.length > 0) {
    const bad: ReleaseRecord = { ...record, status: 'inconsistent', inconsistentKeys: failed };
    await putRecord(api, bad);
    return { exitCode: EXIT_INCONSISTENT, status: 'inconsistent', record: bad };
  }
  const withdrawn: ReleaseRecord = { ...record, status: 'withdrawn' };
  await putRecord(api, withdrawn);
  log(`Release ${key} withdrawn: its offers, prices and cart discounts are gone and nothing it held back changed.`);
  return { exitCode: EXIT.OK, status: 'withdrawn', record: withdrawn };
}
