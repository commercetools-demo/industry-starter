import { describe, expect, it } from 'vitest';
import { assessAvailability } from './medicine-availability';
import { isMedicineKey, medicineKeyForSku, medicinePathForSku } from './medicine-key';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

describe('product-detail-page: medicine links', () => {
  it('a medicine SKU maps to its product key and page path', () => {
    expect(medicineKeyForSku('MED-ibuprofen-400-mg')).toBe('mlv-med-ibuprofen-400-mg');
    expect(medicinePathForSku('MED-ibuprofen-400-mg')).toBe('/medicine/mlv-med-ibuprofen-400-mg');
  });

  it('anything that is not a medicine SKU gets no link', () => {
    for (const sku of ['DOC-okafor', '', null, undefined, 'MED-', 'MED-../x', 'MED-a b']) expect(medicinePathForSku(sku)).toBeNull();
  });

  it('only product keys of medicines are valid keys', () => {
    expect(isMedicineKey('mlv-med-x')).toBe(true);
    expect(isMedicineKey('mlv-doc-x')).toBe(false);
    expect(isMedicineKey('mlv-med-../x')).toBe(false);
  });
});

describe('expiry-dated-supply: public availability states', () => {
  const base = { minRemainingShelfLifeDays: 30, shortDatedPrice: null, today: '2026-10-09' };

  it('unknown stock states nothing', () => {
    expect(assessAvailability({ ...base, supply: undefined })).toBeNull();
  });

  it('no stock is out of stock', () => {
    expect(assessAvailability({ ...base, supply: { available: 0 } })).toEqual({ status: 'out-of-stock' });
  });

  it('undated goods are unaffected', () => {
    expect(assessAvailability({ ...base, supply: { available: 5 } })).toEqual({ status: 'in-stock' });
  });

  it('stock meeting the promise is in stock and carries its date', () => {
    expect(assessAvailability({ ...base, supply: { available: 5, expiryDate: '2027-01-01' } })).toEqual({ status: 'in-stock', expiryDate: '2027-01-01' });
  });

  it('stock below the promise with its own price is short-dated', () => {
    expect(assessAvailability({ ...base, shortDatedPrice: money(700), supply: { available: 5, expiryDate: '2026-10-20' } })).toEqual({
      status: 'short-dated',
      expiryDate: '2026-10-20',
      shortDatedPrice: money(700),
    });
  });

  it('stock below the promise without a short-dated price is not offered', () => {
    expect(assessAvailability({ ...base, supply: { available: 5, expiryDate: '2026-10-20' } })).toEqual({ status: 'shelf-life', expiryDate: '2026-10-20' });
  });

  it('stock already past its date is never offered, even with a short-dated price', () => {
    expect(assessAvailability({ ...base, shortDatedPrice: money(700), supply: { available: 5, expiryDate: '2026-10-01' } })).toMatchObject({ status: 'shelf-life' });
  });
});
