import type { DiscountCodeDraft } from '../types';
import { ls } from './catalog-types';

export const discountCodes: DiscountCodeDraft[] = [
  {
    key: 'malva-dc-welcome10',
    name: ls('Welcome offer', 'Willkommensangebot'),
    description: ls('$10 off the first order.', '10 € Rabatt auf die erste Bestellung.'),
    code: 'WELCOME10',
    cartDiscounts: ['malva-cd-welcome-10'],
    isActive: true,
  },
];
