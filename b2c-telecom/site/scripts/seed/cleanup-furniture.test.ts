import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { LISTING_BEGIN, LISTING_END, listingHash, computeDeleteSet, main, oa04Approved, readStoredListing } from './cleanup-furniture';
import { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const CONFIRM = ['--confirm-project', 'spec-test-b2c-telecom'];
const FURNITURE = ['bedding-bundle', 'furniture-and-decor', 'product-sets'];

let dir: string;
let findingsPath: string;
let todoPath: string;
let backupDir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cleanup-'));
  findingsPath = path.join(dir, 'PROJECT-FINDINGS.md');
  todoPath = path.join(dir, 'TODO.md');
  backupDir = path.join(dir, 'backup');
  writeFileSync(findingsPath, `# Findings\n\n${LISTING_BEGIN}\n${LISTING_END}\n`);
  writeFileSync(todoPath, '| OA-04 | Approve | F | PENDING |\n');
});

/** The baseline shape of 2026-10-07: 3 types, products, 29 categories, inventory, FurnitureBOGO and BOGO. */
function baseline(): FakeCt {
  const api = new FakeCt();
  const types = FURNITURE.map((key) => api.seed('product-types', { key, name: key, attributes: [] }));
  const roots = ['furniture', 'home-decor', 'new-arrivals', 'kitchen'].map((key) => api.seed('categories', { key, ancestors: [] }));
  const cats = [...roots];
  for (let i = 0; i < 25; i++) cats.push(api.seed('categories', { key: `sub-${i}`, ancestors: [{ typeId: 'category', id: roots[i % 4].id }] }));
  for (let i = 0; i < 6; i++) {
    const sku = `SPC-0${i}`;
    const cat = { typeId: 'category', id: cats[i + 4].id };
    const projection = { masterVariant: { sku }, variants: [], categories: [cat] };
    api.seed('products', { key: `sample-${i}`, productType: { typeId: 'product-type', id: types[i % 3].id }, masterData: { published: true, hasStagedChanges: false, current: projection, staged: projection } });
    api.seed('inventory', { sku, quantityOnStock: 100 });
  }
  const bogo = api.seed('cart-discounts', { key: 'FurnitureBOGO', cartPredicate: 'lineItemExists(productType.key = "furniture-and-decor") = true' });
  api.seed('cart-discounts', { key: 'FreeShip100', cartPredicate: 'totalPrice >= "100.00 USD"' });
  api.seed('discount-codes', { key: 'BOGO', code: 'BOGO', cartDiscounts: [{ typeId: 'cart-discount', id: bogo.id }] });
  api.seed('orders', { orderNumber: '1' });
  api.seed('carts', {});
  api.seed('customers', { email: 'a@example.test' });
  api.seed('shipping-methods', { key: 'standard-shipping' });
  api.seed('tax-categories', { key: 'standard-tax' });
  api.seed('zones', { key: 'usa' });
  api.seed('stores', { key: 'b2c-retail-store' });
  api.seed('channels', { key: 'inventory-channel' });
  return api;
}

async function run(api: FakeCt, argv: string[]) {
  const lines: string[] = [];
  const code = await main(argv, { api, source: SOURCE, log: (l) => lines.push(l), findingsPath, todoPath, backupDir, now: () => new Date('2026-10-07T12:00:00Z') });
  return { code, out: lines.join('\n') };
}

describe('cleanup-furniture --list', () => {
  it('lists every class, the exclusion lists, the hash, and writes the block and the backup', async () => {
    const api = baseline();
    const { code, out } = await run(api, ['--list']);
    expect(code).toBe(0);
    expect(out).toContain('product types (3)');
    expect(out).toContain('products (6)');
    expect(out).toContain('cart discounts (1): FurnitureBOGO');
    expect(out).toContain('discount codes (1): BOGO');
    expect(out).toContain('inventory entries (6)');
    expect(out).toContain('categories (29)');
    for (const excluded of ['orders (1)', 'carts (1)', 'customers (1)', 'shipping-methods (1): standard-shipping', 'tax-categories (1): standard-tax', 'zones (1): usa', 'stores (1): b2c-retail-store', 'channels (1): inventory-channel', 'cart-discounts (kept) (1): FreeShip100']) {
      expect(out).toContain(excluded);
    }
    const stored = readStoredListing(readFileSync(findingsPath, 'utf8'));
    expect(stored.sha).toBe(listingHash((await computeDeleteSet(api)).set));
    expect(readdirSync(backupDir)).toEqual([stored.backup]);
    expect(api.writes).toBe(0);
  });

  it('an inventory entry matching no deleted product stops with exit 4 (UNMATCHED)', async () => {
    const api = baseline();
    api.seed('inventory', { sku: 'ORPHAN-1', quantityOnStock: 1 });
    const { code, out } = await run(api, ['--list']);
    expect(code).toBe(4);
    expect(out).toContain('UNMATCHED');
    expect(out).toContain('ORPHAN-1');
  });

  it('a product of another non-Malva product type stops with exit 4 and names the key', async () => {
    const api = baseline();
    const other = api.seed('product-types', { key: 'gadgets', name: 'g', attributes: [] });
    api.seed('products', { key: 'gadget', productType: { typeId: 'product-type', id: other.id }, masterData: { published: true, current: {}, staged: {} } });
    const { code, out } = await run(api, ['--list']);
    expect(code).toBe(4);
    expect(out).toContain('gadgets');
  });

  it('Malva data is never part of the delete set', async () => {
    const api = baseline();
    const malvaType = api.seed('product-types', { key: 'malva-offer', name: 'o', attributes: [] });
    api.seed('products', { key: 'malva-offer-x', productType: { typeId: 'product-type', id: malvaType.id }, masterData: { published: true, current: { masterVariant: { sku: 'MLV-X' } }, staged: { masterVariant: { sku: 'MLV-X' } } } });
    api.seed('inventory', { sku: 'MLV-X', key: 'malva-inv-MLV-X', quantityOnStock: 1 });
    api.seed('categories', { key: 'malva-cat-devices', ancestors: [] });
    const { code } = await run(api, ['--list']);
    expect(code).toBe(0);
    const { set } = await computeDeleteSet(api);
    expect(set.products.map((p) => p.key)).not.toContain('malva-offer-x');
    expect(set.categories.map((c) => c.key)).not.toContain('malva-cat-devices');
    expect(set.inventory.map((i) => i.sku)).not.toContain('MLV-X');
    expect(set.productTypes.map((t) => t.key)).not.toContain('malva-offer');
  });

  it('with nothing left it prints "Nothing to clean up." and exits 0', async () => {
    const api = new FakeCt();
    const { code, out } = await run(api, ['--list']);
    expect(code).toBe(0);
    expect(out).toContain('Nothing to clean up.');
    expect(existsSync(backupDir)).toBe(false);
  });
});

describe('cleanup-furniture --execute', () => {
  async function approved(api: FakeCt) {
    await run(api, ['--list']);
    writeFileSync(todoPath, '| OA-04 | Approve | F | APPROVED |\n');
  }

  it('execute without OA-04 APPROVED exits 5 and deletes nothing', async () => {
    const api = baseline();
    await run(api, ['--list']);
    api.log.length = 0;
    const { code, out } = await run(api, ['--execute', ...CONFIRM]);
    expect(code).toBe(5);
    expect(out).toContain('OA-04');
    expect(api.log).toEqual([]);
    expect(api.writes).toBe(0);
  });

  it('hash mismatch exits 5', async () => {
    const api = baseline();
    await approved(api);
    api.seed('categories', { key: 'surprise', ancestors: [] });
    const { code, out } = await run(api, ['--execute', ...CONFIRM]);
    expect(code).toBe(5);
    expect(out).toContain('changed since the approved listing');
    expect(api.log).toEqual([]);
  });

  it('refuses without the confirmation flag (exit 2)', async () => {
    const api = baseline();
    await approved(api);
    const { code } = await run(api, ['--execute']);
    expect(code).toBe(2);
    expect(api.log).toEqual([]);
  });

  it('refuses when the backup file is missing', async () => {
    const api = baseline();
    await approved(api);
    for (const f of readdirSync(backupDir)) writeFileSync(path.join(backupDir, f), '{}');
    const stored = readStoredListing(readFileSync(findingsPath, 'utf8'));
    writeFileSync(findingsPath, readFileSync(findingsPath, 'utf8').replace(String(stored.backup), 'furniture-missing.json'));
    const { code, out } = await run(api, ['--execute', ...CONFIRM]);
    expect(code).toBe(5);
    expect(out).toContain('no backup');
  });

  it('deletes in order: codes, discounts, products (unpublish + delete), inventory, categories deepest first, product types', async () => {
    const api = baseline();
    await approved(api);
    api.log.length = 0;
    const { code, out } = await run(api, ['--execute', ...CONFIRM]);
    expect(code).toBe(0);
    expect(out).toContain('Furniture data removed.');
    const kinds = api.log.map((l) => l.split(' ').slice(0, 2).join(' '));
    const firstIndex = (needle: string): number => kinds.findIndex((k) => k === needle);
    const lastIndex = (needle: string): number => kinds.lastIndexOf(needle);
    expect(lastIndex('delete discount-codes')).toBeLessThan(firstIndex('delete cart-discounts'));
    expect(lastIndex('delete cart-discounts')).toBeLessThan(firstIndex('update products'));
    expect(firstIndex('update products')).toBeLessThan(firstIndex('delete products'));
    expect(lastIndex('delete products')).toBeLessThan(firstIndex('delete inventory'));
    expect(lastIndex('delete inventory')).toBeLessThan(firstIndex('delete categories'));
    expect(lastIndex('delete categories')).toBeLessThan(firstIndex('delete product-types'));
    // children (with ancestors) before roots
    const categoryDeletes = api.log.filter((l) => l.startsWith('delete categories')).map((l) => l.split(' ')[2]);
    expect(categoryDeletes.indexOf('sub-0')).toBeLessThan(categoryDeletes.indexOf('furniture'));
    expect(categoryDeletes).toHaveLength(29);
    // nothing outside the set was touched
    expect(api.keysOf('cart-discounts')).toEqual(['FreeShip100']);
    expect(api.list('orders')).toHaveLength(1);
    expect(api.list('customers')).toHaveLength(1);
    expect(api.keysOf('shipping-methods')).toEqual(['standard-shipping']);
  });

  it('second run prints "Nothing to clean up."', async () => {
    const api = baseline();
    await approved(api);
    await run(api, ['--execute', ...CONFIRM]);
    api.log.length = 0;
    const { code, out } = await run(api, ['--execute', ...CONFIRM]);
    expect(code).toBe(0);
    expect(out).toContain('Nothing to clean up.');
    expect(api.log).toEqual([]);
  });

  it('a key outside the computed set is never deleted even if the listing file was edited', async () => {
    const api = baseline();
    await approved(api);
    writeFileSync(findingsPath, `${readFileSync(findingsPath, 'utf8')}\nextra: standard-shipping, FreeShip100, usa\n`);
    await run(api, ['--execute', ...CONFIRM]);
    expect(api.byKey('shipping-methods', 'standard-shipping')).toBeDefined();
    expect(api.byKey('cart-discounts', 'FreeShip100')).toBeDefined();
    expect(api.byKey('zones', 'usa')).toBeDefined();
    expect(api.byKey('categories', 'furniture')).toBeUndefined();
  });

  it('only exposes an exact allow-listed project key', async () => {
    const api = baseline();
    const lines: string[] = [];
    const code = await main(['--execute', '--confirm-project', 'other'], { api, source: { CTP_SEED_PROJECT_KEY: 'other' }, log: (l) => lines.push(l), findingsPath, todoPath, backupDir });
    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('"other"');
    expect(api.writes).toBe(0);
  });
});

describe('OA-04 gate parsing', () => {
  it('accepts APPROVED and DONE (also followed by notes), rejects everything else', () => {
    expect(oa04Approved('| OA-04 | x | F | APPROVED |')).toBe(true);
    expect(oa04Approved('| OA-04 | x | F | DONE |')).toBe(true);
    expect(oa04Approved('| OA-04 | x | F | APPROVED and EXECUTED 2026-10-07 (scope) |')).toBe(true);
    expect(oa04Approved('| OA-04 | x | F | PENDING |')).toBe(false);
    expect(oa04Approved('| OA-03 | x | F | APPROVED |')).toBe(false);
  });
});
