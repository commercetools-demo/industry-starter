// npm run seed:plan | seed. Order of a run: target check -> validate -> plan -> apply -> report.
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { buildManifest } from './manifest';
import { applyPlan, newCtx, planAll } from './reconcile';
import { reconcilers as defaultReconcilers } from './reconcilers/registry';
import { activateProductSearch, applyProjectSettings, checkProjectSettings, missingMessage, SearchNotReadyError, waitForSearchIndex } from './project-settings';
import { warnings } from './reconcilers/productType';
import { renderPlan, renderReport } from './report';
import type { AnyReconciler, Kind, SeedManifest } from './types';
import { knownLineItemAttributes, validateManifest } from './validate';

export interface SeedDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  manifest?: SeedManifest;
  reconcilers?: AnyReconciler[];
  log?: Log;
  sleep?: (ms: number) => Promise<void>;
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
  const env = deps.source ?? loadSeedEnv();
  if (args.flags.has('with-demo') && !env.SEED_DEMO_PASSWORD) {
    log('--with-demo needs the environment variable SEED_DEMO_PASSWORD (the password of the demo customers; never committed). Nothing was written.');
    return EXIT.PREFLIGHT;
  }
  try {
    const { api } = await getAdminApi({
      mode: planOnly ? 'read' : 'write',
      confirmProject: args.values.get('confirm-project'),
      source: env,
      api: deps.api,
    });
    const full = deps.manifest ?? buildManifest({ withDemo: args.flags.has('with-demo') });
    const only = args.values.get('only')?.split(',').filter(Boolean) as Kind[] | undefined;
    const manifest = restrict(full, only);

    // project settings: check always, edit only with --apply-project-settings (adds, never removes)
    let settings = await checkProjectSettings(api);
    if (settings.missing.length > 0) {
      if (!args.flags.has('apply-project-settings') || planOnly) {
        log(missingMessage(settings));
        return EXIT.PREFLIGHT;
      }
      await applyProjectSettings(api, settings);
      settings = await checkProjectSettings(api);
      log(`Project settings updated (added only): ${settings.missing.length === 0 ? 'ok' : settings.missing.join(', ')}`);
    }

    const errors = await validateManifest(api, full, reconcilers);
    if (errors.length > 0) {
      for (const e of errors) log(`INVALID ${e.kind} "${e.key}": ${e.message}`);
      log(`${errors.length} validation error(s); nothing was written.`);
      return EXIT.PREFLIGHT;
    }

    const ctx = newCtx();
    if (env.SEED_DEMO_PASSWORD) ctx.demoPassword = env.SEED_DEMO_PASSWORD;
    const plan = await planAll(api, manifest, reconcilers, ctx, await knownLineItemAttributes(api, full));
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
    if (report.exitCode !== EXIT.OK && report.exitCode !== EXIT.SKIPPED) return report.exitCode;

    // Product Search is activated after the data is written so the first index build covers the whole catalog
    const activation = await activateProductSearch(api);
    if (!json) log(activation === 'activated' ? 'Product Search activated (mode ProductsSearch).' : 'Product Search already active.');
    if (!args.flags.has('no-wait')) {
      const expectedKeys = (manifest.product ?? []).map((p) => p.key);
      const { lagMs } = await waitForSearchIndex(api, { expectedKeys, sleep: deps.sleep });
      if (!json) log(`Search index ready (lag ${Math.round(lagMs / 1000)} s, ${expectedKeys.length} product(s)).`);
    }
    return report.exitCode;
  } catch (err) {
    if (err instanceof SearchNotReadyError) {
      log(err.message);
      return err.exitCode;
    }
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
