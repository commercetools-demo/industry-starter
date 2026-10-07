// One-time, destructive, gated cleanup of the furniture sample data (D-054). Idempotent: with nothing left it is a no-op.
//   seed:cleanup -- --list                                       read-only: listing + JSON backup
//   seed:cleanup -- --execute --confirm-project <key>            deletes exactly the listed set (needs OA-04 APPROVED)
// It only ever deletes the three sample product types, what depends on them, the sample categories and the sample
// cart discounts/codes that point at them. The one-off cleanup of 2026-10-07 already ran (see PROJECT-FINDINGS.md).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { furnitureRemoved, FURNITURE_PRODUCT_TYPES } from './checks/platform';
import { consoleLog, exitCodeForError, parseArgs, type Log } from './cli';
import { EXIT, SKU_PREFIX } from './config';
import { CtHttpError, getAdminApi, loadSeedEnv, type CtApi } from './lib';
import { getAll, type Obj } from './reconcilers/util';

export const LISTING_BEGIN = '<!-- CLEANUP-LISTING:BEGIN -->';
export const LISTING_END = '<!-- CLEANUP-LISTING:END -->';
const SITE_DIR = path.resolve(__dirname, '../..');

export interface CleanupDeps {
  api?: CtApi;
  source?: Record<string, string | undefined>;
  log?: Log;
  findingsPath?: string;
  todoPath?: string;
  backupDir?: string;
  now?: () => Date;
}

type Res = Obj & { id: string; version: number; key?: string; sku?: string };
type Ref = { id: string };

export interface DeleteSet {
  productTypes: Res[];
  products: Res[];
  cartDiscounts: Res[];
  discountCodes: Res[];
  inventory: Res[];
  categories: Res[];
}

export interface Computed {
  set: DeleteSet;
  /** Reasons the script must stop with exit 4 (ambiguous dependants). */
  stops: string[];
  excluded: Record<string, string[]>;
  typeKeyById: Record<string, string>;
}

const label = (r: Res): string => String(r.key ?? r.sku ?? r.id);
const sortedLabels = (list: Res[]): string[] => list.map(label).sort();

export function isEmpty(set: DeleteSet): boolean {
  return Object.values(set).every((list) => list.length === 0);
}

export function listingHash(set: DeleteSet): string {
  const canonical = {
    productTypes: sortedLabels(set.productTypes),
    products: sortedLabels(set.products),
    cartDiscounts: sortedLabels(set.cartDiscounts),
    discountCodes: sortedLabels(set.discountCodes),
    inventory: sortedLabels(set.inventory),
    categories: sortedLabels(set.categories),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function variantSkus(product: Res): string[] {
  const md = product.masterData as { current?: { masterVariant?: Obj; variants?: Obj[] }; staged?: { masterVariant?: Obj; variants?: Obj[] } } | undefined;
  const out: string[] = [];
  for (const projection of [md?.current, md?.staged]) {
    for (const v of [projection?.masterVariant, ...(projection?.variants ?? [])]) if (v?.sku) out.push(String(v.sku));
  }
  return out;
}

function productCategoryIds(product: Res): string[] {
  const md = product.masterData as { current?: { categories?: Ref[] }; staged?: { categories?: Ref[] } } | undefined;
  return [...(md?.current?.categories ?? []), ...(md?.staged?.categories ?? [])].map((c) => c.id);
}

export async function computeDeleteSet(api: CtApi): Promise<Computed> {
  const stops: string[] = [];
  const typeKeys = new Set<string>(FURNITURE_PRODUCT_TYPES);
  const productTypes = (await getAll(api, 'product-types')) as Res[];
  const furnitureTypes = productTypes.filter((t) => typeKeys.has(String(t.key)));
  const furnitureTypeIds = new Set(furnitureTypes.map((t) => t.id));
  const typeKeyById = new Map(productTypes.map((t) => [t.id, String(t.key ?? '')]));

  const allProducts = (await getAll(api, 'products')) as Res[];
  const products = allProducts.filter((p) => furnitureTypeIds.has((p.productType as Ref).id));
  const rest = allProducts.filter((p) => !furnitureTypeIds.has((p.productType as Ref).id));
  const foreign = rest.filter((p) => !(typeKeyById.get((p.productType as Ref).id) ?? '').startsWith('malva-'));
  if (foreign.length > 0) {
    const keys = [...new Set(foreign.map((p) => typeKeyById.get((p.productType as Ref).id) ?? 'unknown'))];
    stops.push(`products of other product types exist (${keys.join(', ')}): ${foreign.map(label).join(', ')}`);
  }

  const cartDiscountsAll = (await getAll(api, 'cart-discounts')) as Res[];
  const cartDiscounts = cartDiscountsAll.filter((d) => {
    const text = JSON.stringify([d.cartPredicate, (d.target as { predicate?: unknown } | undefined)?.predicate]);
    return [...typeKeys].some((k) => text.includes(k));
  });
  const discountIds = new Set(cartDiscounts.map((d) => d.id));
  const codes = ((await getAll(api, 'discount-codes')) as Res[]).filter((c) => {
    const refs = (c.cartDiscounts as Ref[] | undefined) ?? [];
    return refs.length > 0 && refs.every((r) => discountIds.has(r.id));
  });

  const skus = new Set(products.flatMap(variantSkus));
  const inventoryAll = (await getAll(api, 'inventory')) as Res[];
  const inventory = inventoryAll.filter((i) => skus.has(String(i.sku)));
  const unmatched = inventoryAll.filter((i) => !skus.has(String(i.sku)) && !String(i.sku).startsWith(SKU_PREFIX));
  if (unmatched.length > 0) stops.push(`UNMATCHED inventory entries (sku matches no deleted product): ${unmatched.map((i) => String(i.sku)).join(', ')}`);

  const categoriesAll = (await getAll(api, 'categories')) as Res[];
  const categories = categoriesAll.filter((c) => !String(c.key ?? '').startsWith('malva-cat-'));
  const categoryIds = new Set(categories.map((c) => c.id));
  const deletedProductIds = new Set(products.map((p) => p.id));
  const blocking = rest.filter((p) => !deletedProductIds.has(p.id) && productCategoryIds(p).some((id) => categoryIds.has(id)));
  if (blocking.length > 0) stops.push(`remaining products are assigned to categories that would be deleted: ${blocking.map(label).join(', ')}`);

  const keysOf = async (collection: string): Promise<string[]> => ((await getAll(api, collection)) as Res[]).map(label).sort();
  const excluded: Record<string, string[]> = {
    orders: await keysOf('orders'),
    carts: await keysOf('carts'),
    customers: await keysOf('customers'),
    'shipping-methods': await keysOf('shipping-methods'),
    'tax-categories': await keysOf('tax-categories'),
    zones: await keysOf('zones'),
    stores: await keysOf('stores'),
    channels: await keysOf('channels'),
    'cart-discounts (kept)': cartDiscountsAll.filter((d) => !discountIds.has(d.id)).map(label).sort(),
  };
  return {
    set: { productTypes: furnitureTypes, products, cartDiscounts, discountCodes: codes, inventory, categories },
    stops,
    excluded,
    typeKeyById: Object.fromEntries(typeKeyById),
  };
}

function compact(list: string[], max = 40): string {
  if (list.length === 0) return '(none)';
  return list.length > max ? `${list.slice(0, max).join(', ')}, ... (${list.length} total)` : list.join(', ');
}

export function renderListing(computed: Computed, backupName: string | undefined, now: Date): string {
  const { set, excluded, stops } = computed;
  const lines = [
    '#### Delete set',
    `- product types (${set.productTypes.length}): ${compact(sortedLabels(set.productTypes))}`,
    `- products (${set.products.length}): ${compact(set.products.map((p) => `${label(p)} [${computed.typeKeyById[(p.productType as Ref).id] ?? 'unknown'}]`).sort())}`,
    `- cart discounts (${set.cartDiscounts.length}): ${compact(sortedLabels(set.cartDiscounts))}`,
    `- discount codes (${set.discountCodes.length}): ${compact(sortedLabels(set.discountCodes))}`,
    `- inventory entries (${set.inventory.length}): ${compact(set.inventory.map((i) => `${String(i.sku)} x${String(i.quantityOnStock)}`).sort())}`,
    `- categories (${set.categories.length}): ${compact(sortedLabels(set.categories))}`,
    '',
    '#### Not deleted (recorded only)',
    ...Object.entries(excluded).map(([k, v]) => `- ${k} (${v.length}): ${compact(v, 12)}`),
  ];
  if (stops.length > 0) lines.push('', '#### Stops (resolve before executing)', ...stops.map((s) => `- ${s}`));
  lines.push('', `listing-sha256: ${listingHash(set)}`, `listing-generated: ${now.toISOString()}`);
  if (backupName) lines.push(`listing-backup: ${backupName}`);
  return lines.join('\n');
}

export function replaceListingBlock(markdown: string, body: string): string {
  const begin = markdown.indexOf(LISTING_BEGIN);
  const end = markdown.indexOf(LISTING_END);
  if (begin === -1 || end === -1 || end < begin) throw new Error(`markers ${LISTING_BEGIN} / ${LISTING_END} not found in the findings file`);
  return `${markdown.slice(0, begin + LISTING_BEGIN.length)}\n${body}\n${markdown.slice(end)}`;
}

export function readStoredListing(markdown: string): { sha?: string; backup?: string } {
  const begin = markdown.indexOf(LISTING_BEGIN);
  const end = markdown.indexOf(LISTING_END);
  if (begin === -1 || end === -1) return {};
  const block = markdown.slice(begin, end);
  return { sha: /listing-sha256: ([0-9a-f]{64})/.exec(block)?.[1], backup: /listing-backup: (\S+)/.exec(block)?.[1] };
}

/** Status cell of the OA-04 row: the last cell; APPROVED or DONE as its first word opens the gate. */
export function oa04Approved(todoMarkdown: string): boolean {
  const row = todoMarkdown.split('\n').find((l) => l.startsWith('| OA-04 |'));
  if (!row) return false;
  const cells = row.split('|').map((c) => c.trim()).filter((c, i, all) => !(c === '' && (i === 0 || i === all.length - 1)));
  const status = cells[cells.length - 1] ?? '';
  return /^(APPROVED|DONE)\b/.test(status);
}

async function deleteById(api: CtApi, collection: string, item: Res, log: Log, name: string): Promise<void> {
  try {
    await api.del(`${collection}/${item.id}`, { version: item.version });
    log(`deleted ${name} ${label(item)}`);
  } catch (err) {
    if (err instanceof CtHttpError && err.statusCode === 404) {
      log(`deleted ${name} ${label(item)} (already gone)`);
      return;
    }
    if (err instanceof CtHttpError && err.statusCode === 409) {
      const fresh = (await api.get(`${collection}/${item.id}`)) as Res | null;
      if (fresh === null) return;
      await api.del(`${collection}/${item.id}`, { version: fresh.version });
      log(`deleted ${name} ${label(item)}`);
      return;
    }
    throw err;
  }
}

async function executeDeletes(api: CtApi, set: DeleteSet, log: Log): Promise<void> {
  for (const c of set.discountCodes) await deleteById(api, 'discount-codes', c, log, 'discount code');
  for (const d of set.cartDiscounts) await deleteById(api, 'cart-discounts', d, log, 'cart discount');
  for (const p of set.products) {
    try {
      const res = (await api.post(`products/${p.id}`, { version: p.version, actions: [{ action: 'unpublish' }] })) as { version: number };
      await api.del(`products/${p.id}`, { version: res.version });
      log(`deleted product ${label(p)}`);
    } catch (err) {
      if (err instanceof CtHttpError && err.statusCode === 404) {
        log(`deleted product ${label(p)} (already gone)`);
        continue;
      }
      throw err;
    }
  }
  for (const i of set.inventory) await deleteById(api, 'inventory', i, log, 'inventory');
  const depth = (c: Res): number => ((c.ancestors as unknown[] | undefined) ?? []).length;
  for (const c of [...set.categories].sort((a, b) => depth(b) - depth(a))) await deleteById(api, 'categories', c, log, 'category');
  for (const t of set.productTypes) await deleteById(api, 'product-types', t, log, 'product type');
}

export async function main(argv: string[], deps: CleanupDeps = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project']);
  const execute = args.flags.has('execute');
  const findingsPath = deps.findingsPath ?? path.resolve(SITE_DIR, '../plan/PROJECT-FINDINGS.md');
  const todoPath = deps.todoPath ?? path.resolve(SITE_DIR, '../plan/TODO-MANUAL-TESTING.md');
  const backupDir = deps.backupDir ?? path.resolve(__dirname, '.backup');
  const now = deps.now ?? (() => new Date());
  try {
    if (!execute && !args.flags.has('list')) {
      log('Usage: seed:cleanup -- --list | --execute --confirm-project <key>');
      return EXIT.PREFLIGHT;
    }
    const { api, projectKey } = await getAdminApi({ mode: execute ? 'write' : 'read', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const computed = await computeDeleteSet(api);
    if (computed.stops.length > 0) {
      for (const s of computed.stops) log(`STOP: ${s}`);
      return EXIT.SKIPPED;
    }

    if (!execute) {
      let backupName: string | undefined;
      if (!isEmpty(computed.set)) {
        mkdirSync(backupDir, { recursive: true });
        backupName = `furniture-${now().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(path.join(backupDir, backupName), JSON.stringify(computed.set, null, 2));
      }
      const listing = renderListing(computed, backupName, now());
      if (existsSync(findingsPath)) writeFileSync(findingsPath, replaceListingBlock(readFileSync(findingsPath, 'utf8'), listing));
      log(listing);
      if (isEmpty(computed.set)) log('Nothing to clean up.');
      return EXIT.OK;
    }

    if (isEmpty(computed.set)) {
      log('Nothing to clean up.');
      return EXIT.OK;
    }
    const todo = existsSync(todoPath) ? readFileSync(todoPath, 'utf8') : '';
    if (!oa04Approved(todo)) {
      log('Refusing to delete: OA-04 is not APPROVED in plan/TODO-MANUAL-TESTING.md.');
      return EXIT.GATE;
    }
    const stored = readStoredListing(existsSync(findingsPath) ? readFileSync(findingsPath, 'utf8') : '');
    const fresh = listingHash(computed.set);
    if (stored.sha !== fresh) {
      log(`Refusing to delete: the project changed since the approved listing (stored ${stored.sha ?? 'none'}, now ${fresh}). Run --list again and ask again.`);
      return EXIT.GATE;
    }
    if (!stored.backup || !existsSync(path.join(backupDir, stored.backup))) {
      log('Refusing to delete: no backup file from the --list run exists.');
      return EXIT.GATE;
    }
    await executeDeletes(api, computed.set, log);
    const check = await furnitureRemoved.run(api, { projectKey });
    if (!check.ok) {
      log(`Furniture check failed after deletion: ${check.detail ?? ''}`);
      return EXIT.FAILED;
    }
    log('Furniture data removed.');
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
