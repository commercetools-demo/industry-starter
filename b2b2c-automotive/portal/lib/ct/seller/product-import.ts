// CSV product import (W-13, W-14, D7): validation (never persists) and the commit through the Import API. The commit re-validates
// the file on the server: the client sends the file again, never a list of validated rows. New products only, keys
// `local-<storeKey>-<sku>` (a product draft import is destructive for an existing key, so existing keys are refused). Prices follow
// as standalone prices in a second container, after every product operation is final. Imported products are local parts approved
// at once (a CSV can never carry fitment) and are then assigned to the store selection.
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import type { CommitResult, ValidationReport } from '@/lib/w-types';
import type { MappingOverrides } from '@/lib/import/columns';
import { CsvError, parseCsv, type ParsedCsv } from '@/lib/import/csv';
import { liveTransport, runImport, type ImportTransport } from '@/lib/import/import-api';
import { collectSkus, localProductKey, validateImport, type ImportItem, type ValidationResult } from '@/lib/import/validate';
import { validatePortalEnv } from '@/lib/env';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { assignProducts } from './assortment-write';
import { clearCatalogCaches, listCategories } from './catalog-data';
import { getSellerStore } from './store-info';
import { existingKeys, existingSkus } from './w-products';
import { wRoot } from './w-root';

export type { CommitResult, ValidationReport };

function parse(text: string): ParsedCsv {
  try {
    return parseCsv(text);
  } catch (error) {
    if (error instanceof CsvError) throw new CatalogError(400, error.code, error.message);
    throw error;
  }
}

async function validateParsed(storeKey: string, parsed: ParsedCsv, overrides?: MappingOverrides): Promise<ValidationResult> {
  const categories = await listCategories();
  const skus = collectSkus(parsed, overrides);
  const [skuSet, keySet] = await Promise.all([existingSkus(skus), existingKeys(skus.map((s) => localProductKey(storeKey, s)))]);
  return validateImport(parsed, { storeKey, categoryKeys: new Set(categories.map((c) => c.key)), existingSkus: skuSet, existingKeys: keySet, overrides });
}

export async function validateFile(storeKey: string, text: string, overrides?: MappingOverrides): Promise<ValidationReport> {
  const { items: _items, ...report } = await validateParsed(storeKey, parse(text), overrides);
  void _items;
  return report;
}

export interface CommitOptions {
  overrides?: MappingOverrides;
  transport?: ImportTransport;
  now?: number;
  sleep?: (ms: number) => Promise<void>;
  maxWaitMs?: number;
  intervalMs?: number;
}

async function defaultTransport(): Promise<ImportTransport> {
  if (devFixturesEnabled()) return (await import('@/lib/portal/w-fixture-root')).getWFixture().importTransport;
  const c = validatePortalEnv(process.env).admin;
  return liveTransport({ projectKey: c.projectKey, apiUrl: c.apiUrl, authUrl: c.authUrl, clientId: c.clientId, clientSecret: c.clientSecret, scopes: c.scopes.join(' ') });
}

const stampOf = (now: number) => new Date(now).toISOString().replace(/[-:T]/g, '').slice(0, 14);

async function productIdsByKey(keys: readonly string[]): Promise<string[]> {
  const root = await wRoot();
  const ids: string[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const { body } = await root.productProjections().get({ queryArgs: { where: 'key in :keys', 'var.keys': keys.slice(i, i + 100), staged: false, limit: 100 } }).execute();
    ids.push(...body.results.map((p) => p.id));
  }
  return ids;
}

/** Re-validates, imports the valid and warning rows (never the skipped ones), assigns them to the store's selection. */
export async function commitImport(storeKey: string, text: string, options: CommitOptions = {}): Promise<CommitResult> {
  const validated = await validateParsed(storeKey, parse(text), options.overrides);
  const items: ImportItem[] = validated.items;
  if (items.length === 0) throw new CatalogError(400, 'NOTHING_TO_IMPORT', 'No row can be imported');
  const store = await getSellerStore(storeKey);
  const now = options.now ?? Date.now();
  const run = await runImport(items, {
    storeKey,
    channelKey: store.retailChannel.key,
    transport: options.transport ?? (await defaultTransport()),
    stamp: stampOf(now),
    sleep: options.sleep,
    maxWaitMs: options.maxWaitMs,
    intervalMs: options.intervalMs,
  });
  const done = new Set(run.imported);
  clearCatalogCaches();
  const ids = await productIdsByKey(items.filter((i) => done.has(i.sku)).map((i) => i.key));
  if (ids.length) await assignProducts(storeKey, ids);
  return { imported: run.imported.length, failed: run.failed, skipped: validated.errors, containers: run.containers };
}
