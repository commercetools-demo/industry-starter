// @vitest-environment node
// Static check: the catalog and search reads pass every offer list through filterReleased (coordinated release, D-057).
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

/** Source text of an exported async function, up to the next top-level export or end of file. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start < 0) throw new Error(`export async function ${name} not found`);
  const rest = source.slice(start + 10);
  const next = rest.search(/\nexport /);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('release wiring', () => {
  it('lib/ct/catalog.ts and lib/ct/search.ts import filterReleased from @/lib/offers/release', () => {
    for (const file of ['lib/ct/catalog.ts', 'lib/ct/search.ts']) {
      expect(read(file)).toMatch(/import \{[^}]*\bfilterReleased\b[^}]*\} from '@\/lib\/offers\/release'/);
    }
  });

  it('every exported function that returns mapped offers references filterReleased, directly or through getAllOffers', () => {
    const catalog = read('lib/ct/catalog.ts');
    expect(bodyOf(catalog, 'getAllOffers')).toContain('filterReleased(');
    for (const name of ['getOfferByKey', 'getOffersByKeys', 'getOffersInCategory']) expect(bodyOf(catalog, name)).toContain('getAllOffers(');
    expect(bodyOf(read('lib/ct/search.ts'), 'searchOffers')).toContain('filterReleased(');
  });

  it('the filter runs after the cached read, never inside it', () => {
    const body = bodyOf(read('lib/ct/catalog.ts'), 'getAllOffers');
    const cacheEnd = body.indexOf('CATALOG_TTL');
    expect(body.indexOf('filterReleased(')).toBeGreaterThan(cacheEnd);
  });
});
