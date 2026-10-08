import { describe, expect, it } from 'vitest';
import { checkCeiling } from './rules';
import { isLimitError, mapLimitError } from './limit-errors';
import { MEDICATIONS, medicationInventory, medSku } from '@/scripts/seed/data/medications';

const platformError = (errors: unknown[]) => Object.assign(new Error('Quantity ...'), { statusCode: 400, body: { statusCode: 400, errors } });

describe('dispensing-quantity-limit: Single request exceeding the ceiling (native limit)', () => {
  it('the seed sets the native limit from maxQtyPerOrder on the inventory entry', () => {
    const amox = MEDICATIONS.find((m) => m.slug === 'amoxicillin-500-mg')!;
    expect(medicationInventory(amox)).toMatchObject({ sku: medSku(amox), maxCartQuantity: 2 });
    for (const m of MEDICATIONS.filter((x) => x.maxQtyPerOrder !== undefined)) {
      expect(medicationInventory(m).maxCartQuantity).toBe(m.maxQtyPerOrder);
    }
  });

  it('maps LineItemQuantityAboveLimit to the same refusal shape the BFF rule produces', () => {
    const mapped = mapLimitError(platformError([{ code: 'LineItemQuantityAboveLimit', quantity: 3, maxCartQuantity: 2 }]));
    expect(mapped).toEqual({ reason: 'CEILING', scope: 'order', ceiling: 2, remaining: 2 });
    expect(mapped).toEqual(checkCeiling({ requested: 3, perOrderMax: 2, periodCeiling: null, usedInPeriod: 0 }));
  });

  it('maps LineItemQuantityBelowLimit (documented sample) as a refusal carrying the minimum', () => {
    const sample = platformError([{ code: 'LineItemQuantityBelowLimit', message: "Quantity '1' less than minimum '5'.", quantity: 1, minCartQuantity: 5 }]);
    expect(mapLimitError(sample)).toEqual({ reason: 'CEILING', scope: 'order', ceiling: 5, remaining: 0 });
    expect(isLimitError(sample)).toBe(true);
  });

  it('reads the errors array from the error itself as well as from its body', () => {
    expect(mapLimitError({ errors: [{ code: 'LineItemQuantityAboveLimit', maxCartQuantity: 1 }] })?.ceiling).toBe(1);
  });

  it('other errors are not limit errors', () => {
    for (const e of [platformError([{ code: 'OutOfStock' }]), new Error('boom'), null, 'x', { body: {} }]) {
      expect(mapLimitError(e)).toBeNull();
      expect(isLimitError(e)).toBe(false);
    }
  });
});
