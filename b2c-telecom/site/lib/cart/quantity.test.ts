import { appletv, cable500, phoneUnlimited, routerAx3000 } from './__fixtures__/offers';
import { checkQuantity, quantityRuleFor } from './quantity';

describe('quantity rules', () => {
  it('phone quantity 6 is rejected, 5 accepted, 0 and 1.5 rejected', () => {
    expect(checkQuantity(phoneUnlimited, 5)).toBeNull();
    expect(checkQuantity(phoneUnlimited, 1)).toBeNull();
    expect(checkQuantity(phoneUnlimited, 6)).toMatchObject({ kind: 'limit', reasons: [{ code: 'QUANTITY_OUT_OF_RANGE' }] });
    expect(checkQuantity(phoneUnlimited, 0)).toMatchObject({ kind: 'limit' });
    expect(checkQuantity(phoneUnlimited, 1.5)).toMatchObject({ kind: 'limit' });
  });

  it('a non-phone plan and equipment are fixed at 1 (QUANTITY_FIXED)', () => {
    expect(checkQuantity(cable500, 1)).toBeNull();
    expect(checkQuantity(cable500, 2)).toMatchObject({ kind: 'limit', reasons: [{ code: 'QUANTITY_FIXED', messageKey: 'bundle.blocked.quantityFixed' }] });
    expect(checkQuantity(routerAx3000, 2)?.reasons[0]?.code).toBe('QUANTITY_FIXED');
  });

  it('add-ons follow their parent up to 5', () => {
    expect(quantityRuleFor(appletv)).toEqual({ min: 1, max: 5 });
  });
});
