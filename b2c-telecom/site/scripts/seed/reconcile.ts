// Planning and execution of a seed run. Sequential on purpose (category locking, version conflicts).
import { CtHttpError, type CtApi } from './lib';
import { predicateAttributes } from './validate';
import { SkipError, type AnyReconciler, Change, Ctx, Draft, Kind, Outcome, Plan, PlanItem, SeedManifest } from './types';

export interface ItemResult {
  kind: Kind;
  key: string;
  outcome: Outcome;
}

export function newCtx(): Ctx {
  return { zoneKeys: {} };
}

function sortedReconcilers(reconcilers: AnyReconciler[], manifest: SeedManifest): AnyReconciler[] {
  return reconcilers.filter((r) => (manifest[r.kind]?.length ?? 0) > 0).sort((a, b) => a.order - b.order);
}

function blockedBy(r: AnyReconciler, draft: Draft, blocked: Map<string, string>): string | undefined {
  for (const ref of r.refs(draft)) {
    const reason = blocked.get(`${ref.kind}:${ref.key}`);
    if (reason !== undefined) return `depends on ${ref.kind} "${ref.key}" (${reason})`;
  }
  return undefined;
}

/** Reads the project (GET only) and decides create / update / unchanged / skip for every draft. */
export async function planAll(
  api: CtApi,
  manifest: SeedManifest,
  reconcilers: AnyReconciler[],
  ctx: Ctx = newCtx(),
  knownAttributes?: Set<string>,
): Promise<Plan> {
  const plan: Plan = [];
  const blocked = new Map<string, string>();
  for (const r of sortedReconcilers(reconcilers, manifest)) {
    for (const draft of manifest[r.kind] ?? []) {
      const item: PlanItem = { kind: r.kind, key: draft.key, action: 'unchanged', changes: [] };
      const dependency = blockedBy(r, draft, blocked) ?? missingAttribute(draft, knownAttributes);
      if (dependency) {
        item.action = 'skip';
        item.reason = dependency;
        blocked.set(`${r.kind}:${draft.key}`, item.reason);
      } else {
        const existing = await r.fetch(api, draft.key);
        if (existing === null) item.action = 'create';
        else {
          const { changes, conflict } = r.diff(existing, draft, ctx);
          if (conflict) {
            item.action = 'skip';
            item.reason = conflict;
            blocked.set(`${r.kind}:${draft.key}`, conflict);
          } else if (changes.length > 0) {
            item.action = 'update';
            item.changes = changes;
          }
        }
      }
      plan.push(item);
    }
  }
  return plan;
}

/** The platform rejects a predicate over an attribute no product type defines yet (workstream G seeds them). */
function missingAttribute(draft: Draft, known: Set<string> | undefined): string | undefined {
  if (!known) return undefined;
  const missing = predicateAttributes(draft).filter((name) => !known.has(name));
  return missing.length > 0 ? `attribute "${missing[0]}" is not defined by any product type yet; seed the product types first` : undefined;
}

const MAX_CONFLICT_RETRIES = 3;

function isConflict(err: unknown): boolean {
  return err instanceof CtHttpError && err.statusCode === 409;
}

async function updateWithRetry(api: CtApi, r: AnyReconciler, draft: Draft, ctx: Ctx, initial: { existing: unknown; changes: Change[] }): Promise<Outcome> {
  let { existing, changes } = initial;
  for (let attempt = 0; ; attempt++) {
    try {
      await r.update(api, existing, changes, draft, ctx);
      return { status: 'updated', changes };
    } catch (err) {
      if (!isConflict(err) || attempt >= MAX_CONFLICT_RETRIES) throw err;
      const fresh = await r.fetch(api, draft.key);
      if (fresh === null) throw err;
      const result = r.diff(fresh, draft, ctx);
      if (result.conflict) return { status: 'skipped', reason: result.conflict };
      if (result.changes.length === 0) return { status: 'unchanged' };
      existing = fresh;
      changes = result.changes;
    }
  }
}

async function applyOne(api: CtApi, r: AnyReconciler, draft: Draft, ctx: Ctx): Promise<Outcome> {
  const existing = await r.fetch(api, draft.key);
  if (existing === null) {
    try {
      await r.create(api, draft, ctx);
      return { status: 'created' };
    } catch (err) {
      const duplicate = err instanceof CtHttpError && err.statusCode === 400 && err.code === 'DuplicateField';
      if (!duplicate) throw err;
      const found = await r.fetch(api, draft.key);
      if (found === null) throw err;
      return diffAndUpdate(api, r, draft, ctx, found);
    }
  }
  return diffAndUpdate(api, r, draft, ctx, existing);
}

async function diffAndUpdate(api: CtApi, r: AnyReconciler, draft: Draft, ctx: Ctx, existing: unknown): Promise<Outcome> {
  const { changes, conflict } = r.diff(existing, draft, ctx);
  if (conflict) return { status: 'skipped', reason: conflict };
  if (changes.length === 0) return { status: 'unchanged' };
  return updateWithRetry(api, r, draft, ctx, { existing, changes });
}

/** Executes the plan item by item. A failed or skipped item makes everything that references it `skipped`. */
export async function applyPlan(api: CtApi, manifest: SeedManifest, plan: Plan, reconcilers: AnyReconciler[], ctx: Ctx): Promise<ItemResult[]> {
  const byKind = new Map(reconcilers.map((r) => [r.kind, r]));
  const blocked = new Map<string, string>();
  const results: ItemResult[] = [];
  for (const item of plan) {
    const r = byKind.get(item.kind);
    const draft = manifest[item.kind]?.find((d) => d.key === item.key);
    if (!r || !draft) continue;
    const id = `${item.kind}:${item.key}`;
    const dependency = blockedBy(r, draft, blocked);
    let outcome: Outcome;
    if (dependency) outcome = { status: 'skipped', reason: dependency };
    else if (item.action === 'skip') outcome = { status: 'skipped', reason: item.reason ?? 'conflict' };
    else if (item.action === 'unchanged') outcome = { status: 'unchanged' };
    else {
      try {
        outcome = await applyOne(api, r, draft, ctx);
      } catch (err) {
        outcome =
          err instanceof SkipError
            ? { status: 'skipped', reason: err.message }
            : { status: 'failed', error: err instanceof Error ? err.message : String(err) };
      }
    }
    if (outcome.status === 'skipped') blocked.set(id, outcome.reason);
    if (outcome.status === 'failed') blocked.set(id, `failed: ${outcome.error}`);
    results.push({ kind: item.kind, key: item.key, outcome });
  }
  return results;
}
