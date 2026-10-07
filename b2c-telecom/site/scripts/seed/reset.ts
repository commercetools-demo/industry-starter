// npm run seed:reset: removes what the manifests seeded (owned keys only) or, with --demo, the demo data.
//   seed:reset -- --confirm-project <key>                 dry run: lists what would be removed
//   seed:reset -- --confirm-project <key> --yes           removes it
//   seed:reset -- --confirm-project <key> --demo [--yes]  demo data (marker demoMarker=malva-demo) instead of the manifest
//   add --with-manifest to --demo to do both; --only kind[,kind] restricts the manifest part
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT, isOwnedKey } from './config';
import { DEMO_MARKER_FIELD, DEMO_MARKER_VALUE } from '@/lib/config/demo';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { buildManifest } from './manifest';
import { newCtx } from './reconcile';
import { reconcilers as defaultReconcilers } from './reconcilers/registry';
import { getAll } from './reconcilers/util';
import type { AnyReconciler, Kind, SeedManifest } from './types';

export interface ResetDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  manifest?: SeedManifest;
  reconcilers?: AnyReconciler[];
  log?: Log;
}

// codes before the discounts they reference, discounts before recurrence policies (higher order is removed first)
const TIE_ORDER: Kind[] = ['discountCode', 'cartDiscount', 'customObject'];

function removalOrder(reconcilers: AnyReconciler[]): AnyReconciler[] {
  const rank = (r: AnyReconciler): number => {
    const i = TIE_ORDER.indexOf(r.kind);
    return i === -1 ? TIE_ORDER.length : i;
  };
  return [...reconcilers].sort((a, b) => b.order - a.order || rank(a) - rank(b));
}

async function resetManifest(api: CtApi, manifest: SeedManifest, reconcilers: AnyReconciler[], only: Kind[] | undefined, yes: boolean, log: Log): Promise<number> {
  const ctx = newCtx();
  let failed = 0;
  for (const r of removalOrder(reconcilers)) {
    if (only && !only.includes(r.kind)) continue;
    const drafts = [...(manifest[r.kind] ?? [])].reverse(); // children before parents
    for (const draft of drafts) {
      const existing = (await r.fetch(api, draft.key)) as { key?: string } | null;
      if (existing === null) continue;
      // adopted zones are not ours: the guard looks at the stored resource key for zone coverage
      const ownedKey = r.kind === 'zoneCoverage' ? existing.key ?? draft.key : draft.key;
      if (!isOwnedKey(r.kind, ownedKey)) {
        log(`skip       ${r.kind} ${ownedKey} (not an owned key)`);
        continue;
      }
      if (!yes) {
        log(`would remove ${r.kind} ${ownedKey}`);
        continue;
      }
      try {
        await r.remove(api, existing, ctx);
        log(`removed    ${r.kind} ${ownedKey}`);
      } catch (err) {
        if (err instanceof CtHttpError && err.statusCode === 404) continue;
        if (err instanceof CtHttpError && err.statusCode === 400 && r.kind === 'shippingMethod') {
          log(`skipped    ${r.kind} ${ownedKey}: referenced by an order`);
          continue;
        }
        failed += 1;
        log(`failed     ${r.kind} ${ownedKey}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return failed;
}

const DEMO_COLLECTIONS = ['recurring-orders', 'orders', 'carts', 'customers'] as const;

async function resetDemo(api: CtApi, yes: boolean, log: Log): Promise<number> {
  let failed = 0;
  const where = `custom(fields(${DEMO_MARKER_FIELD}="${DEMO_MARKER_VALUE}"))`;
  for (const collection of DEMO_COLLECTIONS) {
    const found = (await getAll(api, collection, { where })) as { id: string; version: number; recurringOrderState?: string }[];
    for (const item of found) {
      if (!yes) {
        log(`would remove ${collection} ${item.id}`);
        continue;
      }
      try {
        let version = item.version;
        if (collection === 'recurring-orders' && !['Canceled', 'Expired'].includes(String(item.recurringOrderState))) {
          const res = (await api.post(`${collection}/${item.id}`, {
            version,
            actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'demo reset' } }],
          })) as { version: number };
          version = res.version;
        }
        await api.del(`${collection}/${item.id}`, { version });
        log(`removed    ${collection} ${item.id}`);
      } catch (err) {
        if (err instanceof CtHttpError && err.statusCode === 404) continue;
        failed += 1;
        log(`failed     ${collection} ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return failed;
}

export async function main(argv: string[], deps: ResetDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'only']);
  const yes = args.flags.has('yes');
  const demo = args.flags.has('demo');
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    if (!yes) log('Dry run: nothing is removed. Pass --yes to remove.');
    let failed = 0;
    if (!demo || args.flags.has('with-manifest')) {
      const only = args.values.get('only')?.split(',').filter(Boolean) as Kind[] | undefined;
      failed += await resetManifest(api, deps.manifest ?? buildManifest({ withDemo: false }), deps.reconcilers ?? defaultReconcilers, only, yes, log);
    }
    if (demo) failed += await resetDemo(api, yes, log);
    return failed > 0 ? EXIT.FAILED : EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
