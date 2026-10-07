// Project settings (countries, currencies, languages) and Product Search activation (D-056).
// Docs: https://docs.commercetools.com/api/projects/product-search#activate-the-product-search-api
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT } from './config';
import { getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { buildManifest } from './manifest';

export interface SettingsReport {
  countries: string[];
  currencies: string[];
  languages: string[];
  missing: string[];
  searchStatus: 'Activated' | 'Indexing' | 'Deactivated' | string;
}

export const REQUIRED = {
  countries: ['US', 'DE'],
  currencies: ['USD', 'EUR'],
  languages: ['en-US', 'de-DE'],
} as const;

export const DEFAULT_POLL_MS = 20_000;
export const DEFAULT_TIMEOUT_MS = 1_800_000;

type Project = {
  version: number;
  countries?: string[];
  currencies?: string[];
  languages?: string[];
  searchIndexing?: { products?: { status?: string } };
};

async function readProject(api: CtApi): Promise<Project> {
  const project = (await api.get('')) as Project | null;
  if (!project) throw new Error('project not found');
  return project;
}

export async function checkProjectSettings(api: CtApi): Promise<SettingsReport> {
  const project = await readProject(api);
  const countries = project.countries ?? [];
  const currencies = project.currencies ?? [];
  const languages = project.languages ?? [];
  const missing = [
    ...REQUIRED.countries.filter((c) => !countries.includes(c)).map((c) => `country ${c}`),
    ...REQUIRED.currencies.filter((c) => !currencies.includes(c)).map((c) => `currency ${c}`),
    ...REQUIRED.languages.filter((l) => !languages.includes(l)).map((l) => `language ${l}`),
  ];
  return { countries, currencies, languages, missing, searchStatus: project.searchIndexing?.products?.status ?? 'Deactivated' };
}

export function missingMessage(report: SettingsReport): string {
  return `Project settings missing: ${report.missing.join(', ')} (change in Merchant Center: Settings > Project settings > International, or re-run with --apply-project-settings)`;
}

/** Sends the union of the existing and the required values; never removes anything (GB / en-GB stay enabled, D-001). */
export async function applyProjectSettings(api: CtApi, report: SettingsReport): Promise<void> {
  if (report.missing.length === 0) return;
  const project = await readProject(api);
  const union = (have: string[], need: readonly string[]): string[] => [...have, ...need.filter((n) => !have.includes(n))];
  const actions: Record<string, unknown>[] = [];
  if (report.missing.some((m) => m.startsWith('country '))) actions.push({ action: 'changeCountries', countries: union(report.countries, REQUIRED.countries) });
  if (report.missing.some((m) => m.startsWith('currency '))) actions.push({ action: 'changeCurrencies', currencies: union(report.currencies, REQUIRED.currencies) });
  if (report.missing.some((m) => m.startsWith('language '))) actions.push({ action: 'changeLanguages', languages: union(report.languages, REQUIRED.languages) });
  await api.post('', { version: project.version, actions });
}

/** Activates Product Search (mode ProductsSearch only; ProductProjectionsSearch is unavailable for new projects). */
export async function activateProductSearch(api: CtApi): Promise<'already-active' | 'activated'> {
  const project = await readProject(api);
  const status = project.searchIndexing?.products?.status;
  if (status === 'Activated' || status === 'Indexing') return 'already-active';
  await api.post('', { version: project.version, actions: [{ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' }] });
  return 'activated';
}

export class SearchNotReadyError extends Error {
  readonly exitCode = EXIT.SEARCH_NOT_READY;
  constructor(timeoutMs: number) {
    super(`SEARCH_NOT_READY: the search index did not contain every expected product within ${Math.round(timeoutMs / 60000)} minutes (the data itself is written; re-run seed:settings with --wait-only)`);
    this.name = 'SearchNotReadyError';
  }
}

function isNotEnabled(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { statusCode?: number; code?: string }).statusCode === 400 && (err as { code?: string }).code === 'ObjectNotFound';
}

export async function waitForSearchIndex(
  api: CtApi,
  opts: { expectedKeys: string[]; timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<{ lagMs: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  if (opts.expectedKeys.length === 0) return { lagMs: 0 };
  const query = { query: { or: opts.expectedKeys.map((value) => ({ exact: { field: 'key', value } })) }, limit: 1 };
  let elapsed = 0;
  for (;;) {
    try {
      const res = (await api.post('products/search', query)) as { total?: number };
      if (res.total === opts.expectedKeys.length) return { lagMs: elapsed };
    } catch (err) {
      // "Product Search API is not enabled" while indexing: not ready yet
      if (!isNotEnabled(err)) throw err;
    }
    if (elapsed >= timeoutMs) throw new SearchNotReadyError(timeoutMs);
    await sleep(pollMs);
    elapsed += pollMs;
  }
}

export interface SettingsDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
  sleep?: (ms: number) => Promise<void>;
  expectedKeys?: string[];
}

function describeReport(report: SettingsReport): string[] {
  return [
    `countries:  ${report.countries.join(', ')}`,
    `currencies: ${report.currencies.join(', ')}`,
    `languages:  ${report.languages.join(', ')}`,
    `product search: ${report.searchStatus}`,
  ];
}

/** npm run seed:settings -- --confirm-project <key> [--check-only | --wait-only] [--apply-project-settings] [--no-wait] */
export async function main(argv: string[], deps: SettingsDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const readOnly = args.flags.has('check-only') || args.flags.has('wait-only');
  try {
    const { api } = await getAdminApi({
      mode: readOnly ? 'read' : 'write',
      confirmProject: args.values.get('confirm-project'),
      source: deps.source ?? loadSeedEnv(),
      api: deps.api,
    });
    const expectedKeys = deps.expectedKeys ?? (buildManifest().product ?? []).map((p) => p.key);
    if (args.flags.has('wait-only')) {
      const { lagMs } = await waitForSearchIndex(api, { expectedKeys, sleep: deps.sleep });
      log(`Search index ready (lag ${Math.round(lagMs / 1000)} s, ${expectedKeys.length} product(s)).`);
      return EXIT.OK;
    }
    let report = await checkProjectSettings(api);
    for (const line of describeReport(report)) log(line);
    if (report.missing.length > 0) {
      if (!args.flags.has('apply-project-settings') || readOnly) {
        log(missingMessage(report));
        return EXIT.PREFLIGHT;
      }
      await applyProjectSettings(api, report);
      report = await checkProjectSettings(api);
      log(`Project settings updated (added only): ${report.missing.length === 0 ? 'ok' : report.missing.join(', ')}`);
    }
    if (args.flags.has('check-only')) return EXIT.OK;
    const activation = await activateProductSearch(api);
    log(activation === 'activated' ? 'Product Search activated (mode ProductsSearch).' : 'Product Search already active.');
    if (!args.flags.has('no-wait')) {
      const { lagMs } = await waitForSearchIndex(api, { expectedKeys, sleep: deps.sleep });
      log(`Search index ready (lag ${Math.round(lagMs / 1000)} s, ${expectedKeys.length} product(s)).`);
    }
    return EXIT.OK;
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
