// Read-only live check of the catalog reads (M-G-1, M-G-2). Run from site/:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/search-check.ts
import { searchProducts, type SearchParams } from '../lib/ct/search';
import { formatMoney } from '../lib/utils';

const markets = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US' },
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE' },
} as const;

async function show(label: string, params: SearchParams): Promise<void> {
  const r = await searchProducts(params);
  const first = r.products[0];
  const price = first?.variants[0].price;
  console.log(`${label}: total=${r.total} page=${r.page} returned=${r.products.length}`);
  const shown = price ? formatMoney(price.centAmount, price.currencyCode, params.locale) : '(no price)';
  console.log(`  first: ${first?.name ?? '-'} ${shown}`);
  console.log(`  names: ${r.products.slice(0, 5).map((p) => p.name).join(', ')}`);
}

async function main(): Promise<void> {
  await show('en-US search "milk"', { ...markets['en-US'], text: 'milk' });
  await show('en-US all, page 2', { ...markets['en-US'], page: 2 });
  await show('de-DE all, page 1', markets['de-DE']);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
