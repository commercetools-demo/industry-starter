import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { NUMBER, STRING, field } from './fields';

/** Workstream T (D-032): the non-sensitive descriptor the account page shows for a stored payment method. A PaymentMethod has no brand or last digits of its own. */
export const paymentMethodType: TypeDraft = {
  key: 'malva-payment-method',
  name: ls('Malva payment method', 'Malva-Zahlungsart'),
  description: ls('Card brand, last four digits and expiry shown on the account page. Never holds a card number or token.', 'Kartenmarke, letzte vier Ziffern und Ablaufdatum für die Kontoseite. Enthält nie eine Kartennummer oder ein Token.'),
  resourceTypeIds: ['payment-method'],
  fieldDefinitions: [
    field('brand', 'Brand', 'Marke', {
      name: 'Enum',
      values: [
        { key: 'visa', label: 'Visa' },
        { key: 'mastercard', label: 'Mastercard' },
        { key: 'amex', label: 'Amex' },
        { key: 'unknown', label: 'Unknown' },
      ],
    }),
    field('last4', 'Last four digits', 'Letzte vier Ziffern', STRING),
    field('expMonth', 'Expiry month', 'Ablaufmonat', NUMBER),
    field('expYear', 'Expiry year', 'Ablaufjahr', NUMBER),
  ],
};
