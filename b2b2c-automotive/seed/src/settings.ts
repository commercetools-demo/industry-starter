// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, ProjectView } from './api';
import { getAdmin, isMainModule, parseArgs, Runner, sleep, fail } from './lib';

/**
 * Project settings the storefronts need:
 *  - Product Search indexing ON (it is Deactivated in the sample project) and we wait until it reports Activated
 *  - countryTaxRateFallbackEnabled true (already true; kept true)
 * Languages, countries and currencies of the project are NOT changed (GB DE US ES FR / EUR GBP USD already cover the seed).
 *
 *   npm run seed:settings [-- --dry-run]
 */
export function planProjectActions(project: Pick<ProjectView, 'searchIndexing' | 'carts'>): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = [];
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') {
    actions.push({ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' });
  }
  if (project.carts?.countryTaxRateFallbackEnabled !== true) {
    actions.push({ action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true });
  }
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
    run.note('project settings already as required (search indexing Activated, country tax fallback on)');
    return;
  }
  for (const a of actions) run.note(`  - ${String(a.action)}`);
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
  await ensureProjectSettings(api, new Runner(dryRun));
}

if (isMainModule(import.meta.url)) main().catch(fail);
