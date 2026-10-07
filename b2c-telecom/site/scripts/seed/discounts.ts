// npm run seed:discounts -- --confirm-project spec-test-b2c-telecom
// Creates or updates the introductory-period Cart Discounts of workstream L and the code discount MALVA-CABLE5 of workstream M
// (D-054: allow-listed project, `malva-cd-` keys only).
// Also exports `applyDiscounts`, the loader workstream M reuses for its own discounts.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { cable5Code, cable5Discount } from './data/cart-discounts/code-cable5';
import { buildIntroManifests, apiLookup, type LookupFn } from './data/cart-discounts/intro-defs';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { cartDiscountReconciler } from './reconcilers/cartDiscount';
import { discountCodeReconciler } from './reconcilers/discountCode';
import type { CartDiscountDraft, Ctx, DiscountCodeDraft } from './types';

export const DISCOUNT_KEY_PREFIX = 'malva-cd-';

export interface DiscountOutcome {
  key: string;
  result: 'created' | 'updated' | 'unchanged';
}

/** Idempotent: 404 -> create; present -> one update with only the differing fields; same -> nothing is sent. */
export async function applyDiscounts(api: CtApi, drafts: CartDiscountDraft[], ctx: Ctx = { zoneKeys: {} }): Promise<DiscountOutcome[]> {
  for (const draft of drafts) {
    if (!draft.key.startsWith(DISCOUNT_KEY_PREFIX)) throw new Error(`Refusing to touch cart discount "${draft.key}": keys must start with ${DISCOUNT_KEY_PREFIX}`);
  }
  const outcomes: DiscountOutcome[] = [];
  for (const draft of drafts) {
    const existing = await cartDiscountReconciler.fetch(api, draft.key);
    if (!existing) {
      await cartDiscountReconciler.create(api, draft, ctx);
      outcomes.push({ key: draft.key, result: 'created' });
      continue;
    }
    const { changes } = cartDiscountReconciler.diff(existing, draft, ctx);
    if (changes.length === 0) {
      outcomes.push({ key: draft.key, result: 'unchanged' });
      continue;
    }
    await cartDiscountReconciler.update(api, existing, changes, draft, ctx);
    outcomes.push({ key: draft.key, result: 'updated' });
  }
  return outcomes;
}

/** Discount Codes (workstream M): created when missing, updated when they differ, nothing sent when equal. The discounts they name must exist. */
export async function applyDiscountCodes(api: CtApi, drafts: DiscountCodeDraft[], ctx: Ctx = { zoneKeys: {} }): Promise<DiscountOutcome[]> {
  const outcomes: DiscountOutcome[] = [];
  for (const draft of drafts) {
    const existing = await discountCodeReconciler.fetch(api, draft.key);
    if (!existing) {
      await discountCodeReconciler.create(api, draft, ctx);
      outcomes.push({ key: draft.key, result: 'created' });
      continue;
    }
    const { changes, conflict } = discountCodeReconciler.diff(existing, draft, ctx);
    if (conflict) throw new Error(`Discount code ${draft.key}: ${conflict}`);
    if (changes.length === 0) {
      outcomes.push({ key: draft.key, result: 'unchanged' });
      continue;
    }
    await discountCodeReconciler.update(api, existing, changes, draft, ctx);
    outcomes.push({ key: draft.key, result: 'updated' });
  }
  return outcomes;
}

export interface DiscountsDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  lookup?: LookupFn;
  log?: Log;
}

export async function main(argv: string[], deps: DiscountsDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const drafts = [...(await buildIntroManifests(deps.lookup ?? apiLookup(api))), cable5Discount];
    for (const outcome of await applyDiscounts(api, drafts)) log(`${outcome.result.padEnd(9)} ${outcome.key}`);
    for (const outcome of await applyDiscountCodes(api, [cable5Code])) log(`${outcome.result.padEnd(9)} ${outcome.key}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
