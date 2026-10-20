// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, ProjectView } from './api';
import { COUNTRIES, CURRENCIES, LANGUAGES } from './data/base';
import { fail, getAdmin, isMainModule, parseArgs, Runner, sleep } from './lib';

/**
 * Project settings the storefront needs:
 *  - Product Search indexing ON (mode ProductsSearch) and we wait until it reports Activated
 *  - changeCountryTaxRateFallbackEnabled true
 *  - countries US DE GB, currencies USD EUR GBP, languages en-US en-GB de-DE: ADDED when missing, never removed
 *
 *   npm run seed:settings [-- --dry-run]
 */
const missing = (have: string[], want: readonly string[]): string[] => want.filter((x) => !have.includes(x));

export function planProjectActions(project: Pick<ProjectView, 'searchIndexing' | 'carts' | 'languages' | 'countries' | 'currencies'>): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = [];
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') {
    actions.push({ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' });
  }
  if (project.carts?.countryTaxRateFallbackEnabled !== true) {
    actions.push({ action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true });
  }
  const languages = project.languages ?? [];
  const countries = project.countries ?? [];
  const currencies = project.currencies ?? [];
  if (missing(languages, LANGUAGES).length) actions.push({ action: 'changeLanguages', languages: [...languages, ...missing(languages, LANGUAGES)] });
  if (missing(countries, COUNTRIES).length) actions.push({ action: 'changeCountries', countries: [...countries, ...missing(countries, COUNTRIES)] });
  if (missing(currencies, CURRENCIES).length) actions.push({ action: 'changeCurrencies', currencies: [...currencies, ...missing(currencies, CURRENCIES)] });
  return actions;
}

export interface WaitOptions { intervalMs?: number; timeoutMs?: number; wait?: (ms: number) => Promise<void> }

/** Polls the project until Product Search indexing reports Activated; throws on timeout. Returns the polls used. */
export async function waitForSearchActivation(api: Api, opts: WaitOptions = {}): Promise<number> {
  const interval = opts.intervalMs ?? 5000;
  const timeout = opts.timeoutMs ?? 15 * 60 * 1000;
  const wait = opts.wait ?? sleep;
  let waited = 0;
  for (let polls = 1; ; polls += 1) {
    const status = (await api.getProject()).searchIndexing?.productsSearch?.status;
    if (status === 'Activated') return polls;
    if (waited >= timeout) throw new Error(`Product Search indexing did not become Activated within ${Math.round(timeout / 1000)} s (last status: ${status ?? 'unknown'})`);
    await wait(interval);
    waited += interval;
  }
}

export async function ensureProjectSettings(api: Api, run: Runner, opts: WaitOptions = {}): Promise<void> {
  const project = await api.getProject();
  const actions = planProjectActions(project);
  if (actions.length === 0) {
    run.note('project settings already as required (search indexing Activated, country tax fallback on, countries, currencies, languages present)');
    return;
  }
  for (const a of actions) run.note(`  - ${JSON.stringify(a)}`);
  const updated = await run.act(`update project settings (${actions.length} action(s))`, () => api.updateProject(project.version, actions));
  if (updated && actions.some((a) => a.action === 'changeProductSearchIndexingEnabled')) {
    run.note('waiting for Product Search indexing to become Activated ...');
    await waitForSearchActivation(api, opts);
    run.note('Product Search indexing is Activated');
  }
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const { api } = await getAdmin();
  const run = new Runner(dryRun);
  await ensureProjectSettings(api, run);
  console.log(`${dryRun ? 'dry run: ' : ''}${run.changes} change(s)`);
}

if (isMainModule(import.meta.url)) main().catch(fail);
