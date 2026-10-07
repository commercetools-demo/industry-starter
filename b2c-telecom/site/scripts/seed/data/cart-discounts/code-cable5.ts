// "$5 off Cable with code" and its Discount Code MALVA-CABLE5 (workstream M). Predicates use the backtick-escaped attribute name proven
// live in G-18 (category predicates would need ids; offers are products, so the offer-family attribute is the stable handle).
// Docs: https://docs.commercetools.com/api/projects/cartDiscounts , https://docs.commercetools.com/api/projects/discountCodes
import { CABLE5_CODE, DISCOUNT_AMOUNTS, DISCOUNT_KEYS } from '../../../../lib/config/discounts';
import type { CartDiscountDraft, DiscountCodeDraft } from '../../types';

const CABLE = 'attributes.`offer-family` = "cable"';

export const cable5Discount: CartDiscountDraft = {
  key: DISCOUNT_KEYS.codeCable5,
  name: { 'en-US': '$5 off Cable with code', 'de-DE': '5 € Rabatt auf Kabel mit Code' },
  description: {
    'en-US': 'Cable internet is $5 cheaper with the code MALVA-CABLE5.',
    'de-DE': 'Kabel-Internet ist mit dem Code MALVA-CABLE5 um 5 € günstiger.',
  },
  value: {
    type: 'absolute',
    money: [
      { currencyCode: 'USD', centAmount: DISCOUNT_AMOUNTS.codeCable5.USD },
      { currencyCode: 'EUR', centAmount: DISCOUNT_AMOUNTS.codeCable5.EUR },
    ],
  },
  cartPredicate: `lineItemExists(${CABLE}) = true`,
  target: { type: 'lineItems', predicate: CABLE },
  sortOrder: '0.8',
  stackingMode: 'Stacking',
  isActive: true,
  requiresDiscountCode: true,
  recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
};

export const cable5Code: DiscountCodeDraft = {
  key: CABLE5_CODE.key,
  name: { 'en-US': 'Cable $5 code', 'de-DE': 'Kabel-5-€-Code' },
  code: CABLE5_CODE.code,
  cartDiscounts: [DISCOUNT_KEYS.codeCable5],
  isActive: true,
};
