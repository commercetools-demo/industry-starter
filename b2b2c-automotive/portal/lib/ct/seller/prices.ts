// Reseller prices as standalone prices (T-05, T-06, section 6). This module is the ONLY writer of standalone prices (a test
// greps for it): `setStandalonePrice` is the single function that creates, changes or deletes one; `publishPrices` and the
// bulk and import flows all go through it. There is no price floor and no cost price (Q-T03, Q-V01): a price is valid when it is
// above zero with two decimals (lib/rules/price-money.ts). The Malva base price (no channel) is read here and never written.
import 'server-only';
import type { StandalonePrice } from '@commercetools/platform-sdk';
import { CatalogError, type PriceViolation } from '@/lib/catalog/errors';
import { aboveListPercent, belowListPercent } from '@/lib/catalog/margin';
import { countryOfCurrency, standalonePriceKey, type PriceCurrency } from '@/lib/catalog/price-keys';
import type { BulkPreviewRow, MoneyValue, PricePage, PriceRow } from '@/lib/catalog/types';
import { assertValidPrice, centMoney, INVALID_MONEY_MESSAGE } from '@/lib/rules/price-money';
import { assignedBySku } from './assortment-members';
import type { ProductInfo } from './catalog-data';
import { catalogRoot } from './catalog-root';
import { getSellerStore, type SellerStore } from './store-info';
import { chunk, isNotFound, retryOnConflict } from './versioned';

export { standalonePriceKey } from '@/lib/catalog/price-keys';

type Currency = PriceCurrency;

/** Prices of the SKUs (all channels, all currencies), paged. */
async function readPrices(skus: readonly string[]): Promise<StandalonePrice[]> {
  const root = await catalogRoot();
  const out: StandalonePrice[] = [];
  for (const part of chunk([...new Set(skus)], 50)) {
    for (let offset = 0; ; offset += 500) {
      const { body } = await root.standalonePrices().get({ queryArgs: { where: 'sku in :skus', 'var.skus': part, limit: 500, offset } }).execute();
      out.push(...body.results);
      if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
    }
  }
  return out;
}

const moneyOf = (p: StandalonePrice): MoneyValue => ({ centAmount: p.value.centAmount, currencyCode: p.value.currencyCode });

interface PriceIndex {
  base: (sku: string, currency: Currency) => MoneyValue | null;
  onChannel: (sku: string, channelId: string, currency: Currency) => MoneyValue | null;
}

function indexPrices(prices: readonly StandalonePrice[]): PriceIndex {
  const find = (sku: string, currency: Currency, channelId?: string) =>
    prices.find((p) => p.sku === sku && p.value.currencyCode === currency && (channelId === undefined ? !p.channel : p.channel?.id === channelId));
  return {
    base: (sku, currency) => {
      const p = find(sku, currency);
      return p ? moneyOf(p) : null;
    },
    onChannel: (sku, channelId, currency) => {
      const p = find(sku, currency, channelId);
      return p ? moneyOf(p) : null;
    },
  };
}

/** Malva list price (or, for a store's own item, its retail price) of the SKUs in a currency, for the assortment table. */
export async function listPricesBySku(storeKey: string, skus: readonly string[], currency: Currency = 'EUR'): Promise<Map<string, MoneyValue | null>> {
  const [store, prices] = await Promise.all([getSellerStore(storeKey), readPrices(skus)]);
  const index = indexPrices(prices);
  return new Map(skus.map((sku) => [sku, index.base(sku, currency) ?? index.onChannel(sku, store.retailChannel.id, currency)]));
}

/**
 * The lowest price a shopper of the store can meet for these SKUs (Malva base price, the store's retail override and its branch prices),
 * in the store's first currency; `undefined` when none has a price. Used to refuse an absolute discount that would reach zero (Q-X08).
 */
export async function lowestShopperPrice(storeKey: string, skus: readonly string[]): Promise<number | undefined> {
  if (skus.length === 0) return undefined;
  const store = await getSellerStore(storeKey);
  const currency = store.currencies[0];
  const channelIds = new Set([store.retailChannel.id, ...store.branchChannels.map((c) => c.id)]);
  const cents = (await readPrices(skus)).filter((p) => p.value.currencyCode === currency && (!p.channel || channelIds.has(p.channel.id))).map((p) => p.value.centAmount);
  return cents.length ? Math.min(...cents) : undefined;
}

function requireCurrency(store: SellerStore, currency: Currency | undefined): Currency {
  const c = currency ?? 'EUR';
  if (!store.currencies.includes(c)) throw new CatalogError(400, 'CURRENCY_NOT_SOLD', 'This store does not sell in that currency');
  return c;
}

function channelOf(store: SellerStore, channelKey: string | undefined): { id: string; key: string } {
  if (channelKey === undefined) return store.retailChannel;
  const channel = [store.retailChannel, ...store.branchChannels].find((c) => c.key === channelKey);
  if (!channel) throw new CatalogError(404, 'CHANNEL_NOT_FOUND', 'Not found');
  return channel;
}

/**
 * The price a shopper of the store pays before discounts: the branch price (if a branch channel is named and has one), else the
 * store's retail override, else the Malva base price; `null` for a part with no price (pre-release).
 */
export async function getRetailPrice(storeKey: string, sku: string, channelKey?: string, currency: Currency = 'EUR'): Promise<{ centAmount: number; currencyCode: string } | null> {
  const store = await getSellerStore(storeKey);
  const c = requireCurrency(store, currency);
  const channel = channelOf(store, channelKey);
  const index = indexPrices(await readPrices([sku]));
  return index.onChannel(sku, channel.id, c) ?? index.onChannel(sku, store.retailChannel.id, c) ?? index.base(sku, c);
}

export async function listPrices(storeKey: string, q: { text?: string; currency?: Currency; offset: number; limit: number }): Promise<PricePage> {
  const store = await getSellerStore(storeKey);
  const currency = requireCurrency(store, q.currency);
  const assigned = [...(await assignedBySku(storeKey)).values()];
  const needle = q.text?.trim().toLowerCase();
  const matching = assigned.filter((i) => !needle || i.sku.toLowerCase().includes(needle) || Object.values(i.name).some((n) => n.toLowerCase().includes(needle)));
  const page = matching.slice(q.offset, q.offset + q.limit);
  const index = indexPrices(await readPrices(page.map((i) => i.sku)));
  const rows: PriceRow[] = page.map((info) => {
    const list = index.base(info.sku, currency);
    const override = index.onChannel(info.sku, store.retailChannel.id, currency);
    return {
      sku: info.sku,
      productId: info.id,
      name: info.name,
      listCent: list?.centAmount ?? null,
      overrideCent: override?.centAmount ?? null,
      belowListPercent: list && override ? belowListPercent(override.centAmount, list.centAmount) : null,
      own: info.ownerStore === storeKey,
    };
  });
  return { rows, total: matching.length, currency, currencies: store.currencies };
}

// ---- the single writer ----

/**
 * Creates, changes or deletes the standalone price of `sku` on a channel of the store. `channelKey` defaults to the store's retail
 * channel and must be that channel or one of the store's branch channels. `centAmount: null` deletes the price. The key is the
 * seed's scheme (`<sku>__<channelKey>`, `<sku>__<channelKey>__usd`); the country follows the currency.
 */
export async function setStandalonePrice(storeKey: string, sku: string, channelKey: string | undefined, centAmount: number | null, currency: Currency = 'EUR'): Promise<'created' | 'changed' | 'deleted' | 'unchanged'> {
  const store = await getSellerStore(storeKey);
  const c = requireCurrency(store, currency);
  const channel = channelOf(store, channelKey);
  if (centAmount !== null) assertValidPrice({ price: centMoney(centAmount, c), currency: c });
  const key = standalonePriceKey(sku, channel.key, c);
  const root = await catalogRoot();

  return retryOnConflict(async () => {
    let existing: StandalonePrice | undefined;
    try {
      existing = (await root.standalonePrices().withKey({ key }).get().execute()).body;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    if (centAmount === null) {
      if (!existing) return 'unchanged';
      await root.standalonePrices().withKey({ key }).delete({ queryArgs: { version: existing.version } }).execute();
      return 'deleted';
    }
    if (existing) {
      if (existing.value.centAmount === centAmount && existing.value.currencyCode === c) return 'unchanged';
      await root.standalonePrices().withKey({ key }).post({ body: { version: existing.version, actions: [{ action: 'changeValue', value: { currencyCode: c, centAmount } }] } }).execute();
      return 'changed';
    }
    await root
      .standalonePrices()
      .post({ body: { key, sku, value: centMoney(centAmount, c), country: countryOfCurrency(c), channel: { typeId: 'channel', key: channel.key } } })
      .execute();
    return 'created';
  });
}

// ---- publish (E1 to E4) ----

export interface PublishRequest {
  currency?: Currency;
  changes: { sku: string; centAmount: number | null }[];
  confirm?: boolean;
  expectedCount?: number;
}

export interface PublishResult {
  written: number;
  deleted: number;
}

interface Checked {
  store: SellerStore;
  currency: Currency;
  assigned: Map<string, ProductInfo>;
  index: PriceIndex;
  violations: PriceViolation[];
}

/** The checks of E3 for every change, without throwing: not in the assortment, price pending, money. */
async function checkChanges(storeKey: string, currencyRequest: Currency | undefined, changes: PublishRequest['changes']): Promise<Checked> {
  const store = await getSellerStore(storeKey);
  const currency = requireCurrency(store, currencyRequest);
  const assigned = await assignedBySku(storeKey);
  const index = indexPrices(await readPrices(changes.map((c) => c.sku)));

  const violations: PriceViolation[] = [];
  const seen = new Set<string>();
  for (const change of changes) {
    const attempted = change.centAmount;
    const info = assigned.get(change.sku);
    if (seen.has(change.sku)) violations.push({ sku: change.sku, attemptedCents: attempted, code: 'DUPLICATE_SKU' });
    else if (!info) violations.push({ sku: change.sku, attemptedCents: attempted, code: 'NOT_IN_ASSORTMENT' });
    else if (attempted !== null && !isOwn(info, storeKey) && index.base(change.sku, currency) === null) violations.push({ sku: change.sku, attemptedCents: attempted, code: 'PRICE_PENDING' });
    else if (attempted !== null) {
      try {
        assertValidPrice({ price: centMoney(attempted, currency), currency });
      } catch {
        violations.push({ sku: change.sku, attemptedCents: attempted, code: 'INVALID_MONEY' });
      }
    }
    seen.add(change.sku);
  }
  return { store, currency, assigned, index, violations };
}

export interface ChangePreviewRow {
  sku: string;
  name: Record<string, string>;
  listCent: number | null;
  /** null: the override is removed. */
  newCent: number | null;
  belowListPercent: number;
  aboveListPercent: number;
  /** Set when the change would be refused (INVALID_MONEY, NOT_IN_ASSORTMENT, PRICE_PENDING, DUPLICATE_SKU). */
  problem?: string;
}

/** What a list of changes would do (CSV import preview): every row with its distance from the Malva list and its problem, if any. Writes nothing. */
export async function previewChanges(storeKey: string, request: Pick<PublishRequest, 'currency' | 'changes'>): Promise<{ rows: ChangePreviewRow[]; invalidCount: number; currency: Currency }> {
  const { currency, assigned, index, violations } = await checkChanges(storeKey, request.currency, request.changes);
  const problems = new Map<string, string>();
  for (const v of violations) if (!problems.has(v.sku)) problems.set(v.sku, v.code);
  const rows = request.changes.map<ChangePreviewRow>((change) => {
    const list = index.base(change.sku, currency)?.centAmount ?? null;
    return {
      sku: change.sku,
      name: assigned.get(change.sku)?.name ?? {},
      listCent: list,
      newCent: change.centAmount,
      belowListPercent: list !== null && change.centAmount !== null ? belowListPercent(change.centAmount, list) : 0,
      aboveListPercent: list !== null && change.centAmount !== null ? aboveListPercent(change.centAmount, list) : 0,
      ...(problems.has(change.sku) ? { problem: problems.get(change.sku) } : {}),
    };
  });
  return { rows, invalidCount: rows.filter((r) => r.problem).length, currency };
}

/** Validates the whole batch first (zero writes when any change is invalid), then asks for the count, then writes. */
export async function publishPrices(storeKey: string, request: PublishRequest): Promise<PublishResult> {
  const { currency, violations } = await checkChanges(storeKey, request.currency, request.changes);
  if (violations.length) {
    const code = violations.every((v) => v.code === violations[0].code) ? violations[0].code : 'VALIDATION_FAILED';
    const message = code === 'INVALID_MONEY' ? INVALID_MONEY_MESSAGE : code === 'NOT_IN_ASSORTMENT' ? 'The part is not in your assortment' : code === 'PRICE_PENDING' ? 'The part has no Malva list price yet' : 'Some prices cannot be published';
    throw new CatalogError(400, code, message, { violations });
  }
  if (request.confirm !== true || request.expectedCount !== request.changes.length) {
    throw new CatalogError(409, 'CONFIRMATION_REQUIRED', 'Confirm the number of changed parts', { count: request.changes.length });
  }

  let written = 0;
  let deleted = 0;
  for (const change of request.changes) {
    const result = await setStandalonePrice(storeKey, change.sku, undefined, change.centAmount, currency);
    if (result === 'deleted') deleted += 1;
    else if (result !== 'unchanged') written += 1;
  }
  return { written, deleted };
}

const isOwn = (info: ProductInfo, storeKey: string) => info.ownerStore === storeKey;

// ---- bulk ----

export type BulkMode = 'percentOfList' | 'setTo';

export interface BulkRequest {
  currency?: Currency;
  mode: BulkMode;
  /** percentOfList: percent of the Malva list price (108 means list +8%). setTo: a price in cents. */
  value: number;
  skus?: string[];
  filter?: { text?: string };
}

/** New price per part for a bulk edit, with the distance from the Malva list price; nothing is written. Invalid: zero or less. */
export async function previewBulk(storeKey: string, request: BulkRequest): Promise<{ rows: BulkPreviewRow[]; invalidCount: number; currency: Currency }> {
  const store = await getSellerStore(storeKey);
  const currency = requireCurrency(store, request.currency);
  const assigned = [...(await assignedBySku(storeKey)).values()];
  const needle = request.filter?.text?.trim().toLowerCase();
  const picked = request.skus
    ? assigned.filter((i) => request.skus?.includes(i.sku))
    : assigned.filter((i) => !needle || i.sku.toLowerCase().includes(needle) || Object.values(i.name).some((n) => n.toLowerCase().includes(needle)));
  const index = indexPrices(await readPrices(picked.map((i) => i.sku)));
  const rows: BulkPreviewRow[] = [];
  for (const info of picked) {
    const list = index.base(info.sku, currency);
    if (!list) continue; // price pending: nothing to base a bulk edit on
    const newCent = request.mode === 'setTo' ? Math.round(request.value) : Math.round((list.centAmount * request.value) / 100);
    rows.push({
      sku: info.sku,
      name: info.name,
      listCent: list.centAmount,
      newCent,
      belowListPercent: belowListPercent(newCent, list.centAmount),
      aboveListPercent: aboveListPercent(newCent, list.centAmount),
      invalid: !(newCent > 0),
    });
  }
  return { rows, invalidCount: rows.filter((r) => r.invalid).length, currency };
}

/** Publishes a bulk edit: same checks and confirmation as `publishPrices` (an invalid row stops the whole batch). */
export async function publishBulk(storeKey: string, request: BulkRequest & { confirm?: boolean; expectedCount?: number }): Promise<PublishResult> {
  const preview = await previewBulk(storeKey, request);
  return publishPrices(storeKey, {
    currency: preview.currency,
    changes: preview.rows.map((r) => ({ sku: r.sku, centAmount: r.newCent })),
    confirm: request.confirm,
    expectedCount: request.expectedCount,
  });
}
