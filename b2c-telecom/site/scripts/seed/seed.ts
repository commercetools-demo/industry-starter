// npm run seed:plan | seed. Order of a run: target check -> validate -> plan -> apply -> report.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { buildManifest } from './manifest';
import { applyPlan, newCtx, planAll } from './reconcile';
import { reconcilers as defaultReconcilers } from './reconcilers/registry';
import { warnings } from './reconcilers/productType';
import { renderPlan, renderReport } from './report';
import type { AnyReconciler, Kind, SeedManifest } from './types';
import { validateManifest } from './validate';

export interface SeedDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  manifest?: SeedManifest;
  reconcilers?: AnyReconciler[];
  log?: Log;
}

function restrict(manifest: SeedManifest, only: Kind[] | undefined): SeedManifest {
  if (!only) return manifest;
  return Object.fromEntries(Object.entries(manifest).filter(([kind]) => only.includes(kind as Kind))) as SeedManifest;
}

export async function main(argv: string[], deps: SeedDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'only']);
  const planOnly = args.flags.has('plan');
  const json = args.flags.has('json');
  const reconcilers = deps.reconcilers ?? defaultReconcilers;
  try {
    const { api } = await getAdminApi({
      mode: planOnly ? 'read' : 'write',
      confirmProject: args.values.get('confirm-project'),
      source: deps.source ?? loadSeedEnv(),
      api: deps.api,
    });
    const full = deps.manifest ?? buildManifest({ withDemo: args.flags.has('with-demo') });
    const only = args.values.get('only')?.split(',').filter(Boolean) as Kind[] | undefined;
    const manifest = restrict(full, only);

    const errors = await validateManifest(api, full, reconcilers);
    if (errors.length > 0) {
      for (const e of errors) log(`INVALID ${e.kind} "${e.key}": ${e.message}`);
      log(`${errors.length} validation error(s); nothing was written.`);
      return EXIT.PREFLIGHT;
    }

    const ctx = newCtx();
    const plan = await planAll(api, manifest, reconcilers, ctx);
    if (planOnly) {
      log(json ? JSON.stringify({ plan }) : renderPlan(plan));
      return EXIT.OK;
    }
    const results = await applyPlan(api, manifest, plan, reconcilers, ctx);
    const report = renderReport(results);
    log(json ? JSON.stringify({ results, counts: report.counts, zoneKeys: ctx.zoneKeys }) : report.text);
    if (!json) {
      if (Object.keys(ctx.zoneKeys).length > 0) log(`zones: ${Object.entries(ctx.zoneKeys).map(([c, k]) => `${c}=${k}`).join(' ')}`);
      for (const w of warnings) log(`warning: ${w}`);
    }
    return report.exitCode;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
