import type { Project, ProjectUpdateAction } from '@commercetools/platform-sdk';
import { COUNTRIES, CURRENCIES, LANGUAGES } from './data/locales';
import { getAdminRoot, parseArgs, Runner } from './lib';

/**
 * Project settings the Malva storefront needs (D17). Returns only the actions that are not yet satisfied, so a
 * second run is a no-op. Never removes a language, country or currency the project already has.
 *
 *   npx tsx src/configure-project.ts [--dry-run]
 */
export function planProjectActions(project: Pick<Project, 'languages' | 'countries' | 'currencies'> & Partial<Pick<Project, 'searchIndexing' | 'carts'>>): ProjectUpdateAction[] {
  const actions: ProjectUpdateAction[] = [];
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') {
    actions.push({ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' });
  }
  if (project.carts?.countryTaxRateFallbackEnabled !== true) {
    actions.push({ action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true });
  }
  const missing = (have: string[], want: readonly string[]) => want.filter((x) => !have.includes(x));
  if (missing(project.languages, LANGUAGES).length) actions.push({ action: 'changeLanguages', languages: [...project.languages, ...missing(project.languages, LANGUAGES)] });
  if (missing(project.countries, COUNTRIES).length) actions.push({ action: 'changeCountries', countries: [...project.countries, ...missing(project.countries, COUNTRIES)] });
  if (missing(project.currencies, CURRENCIES).length) actions.push({ action: 'changeCurrencies', currencies: [...project.currencies, ...missing(project.currencies, CURRENCIES)] });
  return actions;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const { root, env } = await getAdminRoot();
  const runner = new Runner(dryRun);
  const project = (await root.get().execute()).body;
  const actions = planProjectActions(project);
  if (actions.length === 0) {
    runner.note(`project ${env.projectKey}: settings already as required, nothing to do`);
    return;
  }
  for (const a of actions) runner.note(`  - ${a.action}`);
  await runner.act(`update project ${env.projectKey} (${actions.length} action(s))`, () => root.post({ body: { version: project.version, actions } }).execute());
}

if (process.argv[1]?.endsWith('configure-project.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
