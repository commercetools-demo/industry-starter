// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', () => ({ cache: <A extends unknown[], R>(fn: (...args: A) => R) => fn }));
const execute = vi.fn();
const get = vi.fn(() => ({ execute }));
const withKey = vi.fn(() => ({ get }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { productProjections: () => ({ withKey }) } }));
const getSupplyBySku = vi.fn();
vi.mock('@/lib/ct/shelf-life', async (importOriginal) => ({ ...(await importOriginal<object>()), getSupplyBySku: (...a: unknown[]) => getSupplyBySku(...a) }));

import { getMedicineByKey } from './medicines';

const attr = (name: string, value: unknown) => ({ name, value });
const projection = {
  id: 'p1',
  key: 'mlv-med-ibuprofen-400-mg',
  productType: { typeId: 'product-type', id: 'pt' },
  name: { 'en-US': 'Ibuprofen 400 mg tablets' },
  slug: { 'en-US': 'ibuprofen-400-mg' },
  description: { 'en-US': 'Pain relief.' },
  categories: [],
  masterVariant: {
    id: 1,
    sku: 'MED-ibuprofen-400-mg',
    images: [{ url: 'https://images.example/a.jpg' }, { url: 'https://images.example/b.jpg' }],
    prices: [{ value: { centAmount: 620, currencyCode: 'USD', fractionDigits: 2 } }],
    attributes: [attr('strength', '400 mg'), attr('dosageForm', 'Tablet'), attr('rxOnly', false), attr('dispenseUnit', 'pack'), attr('maxQtyPerOrder', 5), attr('hsaEligible', true), attr('minRemainingShelfLifeDays', 90)],
  },
};
const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };

beforeEach(() => {
  execute.mockReset().mockResolvedValue({ body: projection });
  withKey.mockClear();
  get.mockClear();
  getSupplyBySku.mockReset().mockResolvedValue(new Map([['MED-ibuprofen-400-mg', { sku: 'MED-ibuprofen-400-mg', available: 12 }]]));
});

describe('product-detail-page: catalog read', () => {
  it('reads the product by key in the visitor currency and country and maps gallery, price and stock', async () => {
    const m = await getMedicineByKey('mlv-med-ibuprofen-400-mg', ctx, new Date('2026-10-09T00:00:00Z'));
    expect(withKey).toHaveBeenCalledWith({ key: 'mlv-med-ibuprofen-400-mg' });
    expect(get).toHaveBeenCalledWith({ queryArgs: expect.objectContaining({ priceCurrency: 'USD', priceCountry: 'US' }) });
    expect(m).toMatchObject({ name: 'Ibuprofen 400 mg tablets', rxOnly: false, price: { centAmount: 620 }, maxQtyPerOrder: 5, hsaEligible: true });
    expect(m?.imageUrls).toEqual(['https://images.example/a.jpg', 'https://images.example/b.jpg']);
    expect(m?.availability).toEqual({ status: 'in-stock' });
  });

  it('an unknown key (404 from the platform) is null', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await getMedicineByKey('mlv-med-nope', ctx)).toBeNull();
  });

  it('a malformed or non-medicine key is null without a platform call', async () => {
    for (const key of ['mlv-doc-x', '../x', 'mlv-med-A B', '']) expect(await getMedicineByKey(key, ctx)).toBeNull();
    expect(withKey).not.toHaveBeenCalled();
  });

  it('other platform errors propagate', async () => {
    execute.mockRejectedValue({ statusCode: 500 });
    await expect(getMedicineByKey('mlv-med-x', ctx)).rejects.toMatchObject({ statusCode: 500 });
  });

  it('a failing stock read hides availability but does not fail the page', async () => {
    getSupplyBySku.mockRejectedValue(new Error('down'));
    const m = await getMedicineByKey('mlv-med-ibuprofen-400-mg', ctx);
    expect(m?.availability).toBeNull();
    expect(m?.name).toBe('Ibuprofen 400 mg tablets');
  });

  it('no price in the visitor currency is not sellable in the region', async () => {
    const m = await getMedicineByKey('mlv-med-ibuprofen-400-mg', { ...ctx, currency: 'EUR' });
    expect(m?.sellableInRegion).toBe(false);
    expect(m?.price).toBeNull();
  });
});
