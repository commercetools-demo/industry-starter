import type { Category as SdkCategory, ProductProjection } from '@commercetools/platform-sdk';
import { CATALOG_TTL, PRODUCT_TYPE_IDS_TTL } from '@/lib/config/cache';
import addonAppleTv from '@/lib/mappers/__fixtures__/addon-appletv.json';
import categoryFixture from '@/lib/mappers/__fixtures__/categories.json';
import deviceNova from '@/lib/mappers/__fixtures__/device-nova-5g.json';
import equipmentRouter from '@/lib/mappers/__fixtures__/equipment-router-ac1200.json';
import offerAddonAppleTv from '@/lib/mappers/__fixtures__/offer-addon-appletv.json';
import offerCable500 from '@/lib/mappers/__fixtures__/offer-cable-500.json';
import offerDeviceNova from '@/lib/mappers/__fixtures__/offer-device-nova-5g.json';
import offerPhoneUnlimited from '@/lib/mappers/__fixtures__/offer-phone-unlimited.json';
import offerRouter from '@/lib/mappers/__fixtures__/offer-router-ac1200.json';
import planCableGig from '@/lib/mappers/__fixtures__/plan-cable-gig.json';
import planPhoneUnlimited from '@/lib/mappers/__fixtures__/plan-phone-unlimited.json';
import productTypes from '@/lib/mappers/__fixtures__/product-types.json';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import type { Market } from '@/lib/types';

type Json = Record<string, unknown>;
const clone = (value: unknown, patch: Json = {}): ProductProjection => ({ ...structuredClone(value as Json), ...patch }) as unknown as ProductProjection;

const typeResponse = { body: { results: productTypes, total: productTypes.length } };
const productTypeGet = vi.fn<(args: unknown) => { execute: () => Promise<typeof typeResponse> }>(() => ({ execute: async () => typeResponse }));
const projectionExecute = vi.fn();
const projectionGet = vi.fn((args: { queryArgs: { where?: string; offset?: number } }) => ({ execute: () => projectionExecute(args.queryArgs) }));
const unstableCache = vi.fn<(fn: () => Promise<unknown>, keys: string[], options: object) => () => Promise<unknown>>((fn) => fn);
const withTimeout = vi.fn<(promise: Promise<unknown>, label: string) => Promise<unknown>>((promise) => promise);

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: object) => unstableCache(fn, keys, options) }));
vi.mock('./client', () => ({ getApiRoot: () => ({ productTypes: () => ({ get: productTypeGet }), productProjections: () => ({ get: projectionGet }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>, label: string) => withTimeout(promise, label) }));
vi.mock('./categories', () => ({
  getCategoryTree: async () => buildCategoryTree((categoryFixture as unknown as SdkCategory[]).map((category) => mapCategory(category, 'en-US'))),
}));

import { getAllOffers, getCatalogFacts, getOfferByKey, getOffersByKeys, getOffersInCategory, getProductTypeIds } from './catalog';

const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const DE: Market = { locale: 'de-DE', currency: 'EUR', country: 'DE' };

const factProjections = [
  clone(planPhoneUnlimited),
  clone(addonAppleTv),
  clone(equipmentRouter),
  clone(deviceNova),
  clone(planCableGig, { key: 'malva-cable-500' }),
];
const noPrice = clone(offerPhoneUnlimited, { key: 'malva-offer-no-price', id: 'no-price' });
for (const variant of [noPrice.masterVariant, ...noPrice.variants]) (variant as { prices?: unknown[] }).prices = [];
const offerProjections = [clone(offerCable500), clone(offerPhoneUnlimited), clone(offerAddonAppleTv), clone(offerRouter), clone(offerDeviceNova), noPrice];
const missingAnchor = clone(offerPhoneUnlimited, { key: 'malva-offer-orphan', id: 'orphan' });
(missingAnchor.masterVariant as { attributes?: unknown[] }).attributes = [
  { name: 'offer-kind', value: { key: 'base-package', label: 'base-package' } },
  { name: 'anchors', value: ['malva-missing-product'] },
];

function respond(offers: ProductProjection[]) {
  projectionExecute.mockImplementation(async (queryArgs: { where?: string; offset?: number }) => {
    const source = queryArgs.where?.startsWith('productType(id in') ? factProjections : offers;
    const offset = queryArgs.offset ?? 0;
    return { body: { results: source.slice(offset, offset + 2), total: source.length, offset } };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  respond([...offerProjections, missingAnchor]);
});
afterEach(() => vi.restoreAllMocks());

describe('catalog reads', () => {
  it('Browse a category: offers are read once per market and carry the market\'s recurring headline price', async () => {
    const offers = await getAllOffers(US);
    const phone = offers.find((offer) => offer.key === 'malva-offer-phone-unlimited');
    expect(phone?.headline.recurring).toEqual({ centAmount: 5000, currencyCode: 'USD' });
    expect(phone?.facts).toMatchObject({ kind: 'plan', family: 'phone' });
    const offerCalls = projectionGet.mock.calls.filter(([args]) => args.queryArgs.where?.startsWith('productType(id="'));
    expect(offerCalls[0]?.[0].queryArgs).toMatchObject({ priceCurrency: 'USD', priceCountry: 'US', staged: false, limit: 500 });
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['offers', 'en-US', 'USD', 'US'], { revalidate: CATALOG_TTL, tags: ['catalog'] });
    const de = await getAllOffers(DE);
    expect(de.find((offer) => offer.key === 'malva-offer-phone-unlimited')?.headline.recurring?.currencyCode).toBe('EUR');
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['offers', 'de-DE', 'EUR', 'DE'], expect.objectContaining({ revalidate: CATALOG_TTL }));
  });

  it('reads pages until the total is reached', async () => {
    const offers = await getAllOffers(US);
    const offerCalls = projectionGet.mock.calls.filter(([args]) => args.queryArgs.where?.startsWith('productType(id="'));
    expect(offerCalls.map(([args]) => args.queryArgs.offset)).toEqual([0, 2, 4, 6]);
    expect(offers.map((offer) => offer.key)).toEqual(['malva-offer-cable-500', 'malva-offer-phone-unlimited', 'malva-offer-appletv', 'malva-offer-router-ac1200', 'malva-offer-phone-nova-5g']);
  });

  it('hides offers without a price in the market or without their anchor product, and logs them', async () => {
    const keys = (await getAllOffers(US)).map((offer) => offer.key);
    expect(keys).not.toContain('malva-offer-no-price');
    expect(keys).not.toContain('malva-offer-orphan');
    expect(console.warn).toHaveBeenCalledWith('[catalog] offer hidden', 'malva-offer-no-price', 'no price for USD/US');
    expect(console.warn).toHaveBeenCalledWith('[catalog] offer hidden', 'malva-offer-orphan', 'anchor product missing');
  });

  it('caches the product type ids and the facts with their own windows and keys', async () => {
    expect(await getProductTypeIds()).toMatchObject({ 'malva-offer': 'b44a5700-4f88-42dc-9764-4c061c75539b' });
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['product-type-ids'], { revalidate: PRODUCT_TYPE_IDS_TTL, tags: ['catalog'] });
    const facts = await getCatalogFacts('de-DE');
    expect(Object.keys(facts).sort()).toEqual(['malva-appletv', 'malva-cable-500', 'malva-phone-nova-5g', 'malva-phone-unlimited', 'malva-router-ac1200']);
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['catalog-facts', 'de-DE'], { revalidate: CATALOG_TTL, tags: ['catalog'] });
    const where = productTypeGet.mock.calls[0]?.[0] as { queryArgs: { where: string } };
    expect(where.queryArgs.where).toContain('"malva-offer"');
  });

  it('every call goes through withTimeout', async () => {
    await getAllOffers(US);
    const labels = withTimeout.mock.calls.map(([, label]) => label);
    expect(labels).toEqual(expect.arrayContaining(['catalog.product-types', 'catalog.facts', 'catalog.offers']));
    expect(new Set(labels)).toEqual(new Set(['catalog.product-types', 'catalog.facts', 'catalog.offers']));
  });

  it('an unpublished offer (not returned by the API) gives null from getOfferByKey', async () => {
    expect((await getOfferByKey('malva-offer-appletv', US))?.name).toBe('Apple TV+');
    expect(await getOfferByKey('malva-offer-unpublished', US)).toBeNull();
  });

  it('getOffersByKeys keeps the requested order and skips unknown keys', async () => {
    const offers = await getOffersByKeys(['malva-offer-router-ac1200', 'nope', 'malva-offer-appletv', 'malva-offer-router-ac1200'], US);
    expect(offers.map((offer) => offer.key)).toEqual(['malva-offer-router-ac1200', 'malva-offer-appletv']);
  });

  it('a category lookup includes the offers of its descendants', async () => {
    const addOns = await getOffersInCategory('malva-cat-add-ons', US);
    expect(addOns.map((offer) => offer.key)).toEqual(expect.arrayContaining(['malva-offer-appletv', 'malva-offer-router-ac1200']));
    expect(addOns.map((offer) => offer.key)).not.toContain('malva-offer-phone-unlimited');
    const streaming = await getOffersInCategory('malva-cat-streaming', US);
    expect(streaming.map((offer) => offer.key)).toEqual(['malva-offer-appletv']);
    expect(await getOffersInCategory('does-not-exist', US)).toEqual([]);
  });
});
