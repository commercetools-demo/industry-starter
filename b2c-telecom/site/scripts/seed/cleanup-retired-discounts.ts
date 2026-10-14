/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Removes the retired Cart Discounts from a live project: the ones that reached recurring orders (second line, bundle, introductory
// prices, year-tier percentages). The seed does not delete what the manifest no longer has, so they stay in the project until this runs.
//   seed:cleanup-discounts                                       read-only: lists what would be removed (default)
//   seed:cleanup-discounts -- --execute --confirm-project <key>  removes exactly that list
// Only cart discounts with the owned prefix (malva-cd-) that are neither in the manifest nor one of the discounts the storefront reads are
// touched; a Merchant Center discount is never removed. A Discount Code that points at a retired discount is removed first. Idempotent.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { MANIFEST } from './data';
import { DISCOUNT_KEYS } from '@/lib/config/discounts';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { getAll, type Obj } from './reconcilers/util';

export const OWNED_DISCOUNT_PREFIX = 'malva-cd-';

export interface CleanupDiscountDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
}

type Res = Obj & { id: string; version: number; key?: string };
type CodeRes = Res & { cartDiscounts?: { id: string }[] };

/** Keys that stay: the manifest's discounts and the ones the storefront names (the code discount is seeded by its own script). */
export function keptDiscountKeys(): Set<string> {
  return new Set([...(MANIFEST.cartDiscount ?? []).map((draft) => draft.key), ...Object.values(DISCOUNT_KEYS)]);
}

export interface RetiredSet {
  discounts: Res[];
  codes: CodeRes[];
}

export async function computeRetired(api: CtApi): Promise<RetiredSet> {
  const kept = keptDiscountKeys();
  const discounts = ((await getAll(api, 'cart-discounts')) as Res[]).filter((discount) => String(discount.key ?? '').startsWith(OWNED_DISCOUNT_PREFIX) && !kept.has(String(discount.key)));
  const ids = new Set(discounts.map((discount) => discount.id));
  const codes = ((await getAll(api, 'discount-codes')) as CodeRes[]).filter((code) => (code.cartDiscounts ?? []).some((reference) => ids.has(reference.id)));
  return { discounts, codes };
}

export async function main(argv: string[], deps: CleanupDiscountDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const execute = args.flags.has('execute');
  try {
    const { api } = await getAdminApi({ mode: execute ? 'write' : 'read', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const retired = await computeRetired(api);
    if (retired.discounts.length === 0) {
      log('Nothing to remove: no retired cart discounts in the project.');
      return EXIT.OK;
    }
    for (const code of retired.codes) log(`${execute ? 'removing ' : 'would remove'} discount code ${String(code.key ?? code.id)}`);
    for (const discount of retired.discounts) log(`${execute ? 'removing ' : 'would remove'} cart discount ${String(discount.key)}`);
    if (!execute) {
      log('Read-only: nothing was removed. Run `npm run seed:cleanup-discounts -- --execute --confirm-project <key>` to remove (the `--` matters: without it npm swallows the flags).');
      return EXIT.OK;
    }
    let failed = 0;
    for (const [collection, list] of [['discount-codes', retired.codes], ['cart-discounts', retired.discounts]] as const) {
      for (const item of list) {
        try {
          await api.del(`${collection}/${item.id}`, { version: item.version });
        } catch (error) {
          if (error instanceof CtHttpError && error.statusCode === 404) continue;
          failed += 1;
          log(`failed     ${collection} ${String(item.key ?? item.id)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return failed > 0 ? EXIT.FAILED : EXIT.OK;
  } catch (error) {
    return exitCodeForError(error, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
