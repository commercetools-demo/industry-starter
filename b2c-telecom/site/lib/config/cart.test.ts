import { ACTIVATION_FEE_TAX_CATEGORY_KEY, MAX_PHONE_LINES, MINIMUM_ORDER_VALUE, QUANTITY_RULES } from './cart';
import { DISCOUNT_AMOUNTS, DISCOUNT_KEYS } from './discounts';

describe('cart config', () => {
  it('MINIMUM_ORDER_VALUE has USD and EUR integers (cents)', () => {
    expect(Number.isInteger(MINIMUM_ORDER_VALUE.USD)).toBe(true);
    expect(Number.isInteger(MINIMUM_ORDER_VALUE.EUR)).toBe(true);
    expect(MINIMUM_ORDER_VALUE).toEqual({ USD: 3000, EUR: 2800 });
  });

  it('phone plans take 1 to 5 lines, every other plan exactly 1', () => {
    expect(QUANTITY_RULES.plan_phone).toEqual({ min: 1, max: MAX_PHONE_LINES });
    expect(MAX_PHONE_LINES).toBe(5);
    expect(QUANTITY_RULES.plan_other).toEqual({ min: 1, max: 1 });
  });

  it('the fee tax category is the placeholder category F seeded', () => {
    expect(ACTIVATION_FEE_TAX_CATEGORY_KEY).toBe('malva-telecom-services');
  });

  it('DISCOUNT_AMOUNTS are integers in USD and EUR and the keys are malva-cd- keys', () => {
    for (const amounts of Object.values(DISCOUNT_AMOUNTS)) {
      expect(Number.isInteger(amounts.USD)).toBe(true);
      expect(Number.isInteger(amounts.EUR)).toBe(true);
    }
    for (const key of Object.values(DISCOUNT_KEYS)) expect(key.startsWith('malva-cd-')).toBe(true);
  });
});
