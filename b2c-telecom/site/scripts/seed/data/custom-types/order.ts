import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { CART_FIELDS, DATE, STRING, field } from './fields';

// A resource carries one type, so malva-order is a superset of malva-cart: values survive the cart-to-order handover.
export const orderType: TypeDraft = {
  key: 'malva-order',
  name: ls('Malva order', 'Malva-Bestellung'),
  description: ls('Service start, price schedule, label snapshot, cancellation and return records.', 'Servicebeginn, Preisplan, Label-Schnappschuss, Kündigung und Rückgabe.'),
  resourceTypeIds: ['order'],
  fieldDefinitions: [
    field('serviceStartDate', 'Service start date', 'Servicebeginn', DATE),
    field('priceSchedule', 'Price schedule (JSON)', 'Preisplan (JSON)', STRING, false, 'MultiLine'),
    field('labelSnapshot', 'Label snapshot (JSON)', 'Label-Schnappschuss (JSON)', STRING, false, 'MultiLine'),
    field('cancellation', 'Cancellation (JSON)', 'Kündigung (JSON)', STRING, false, 'MultiLine'),
    field('returnRequest', 'Return request (JSON)', 'Rückgabeantrag (JSON)', STRING, false, 'MultiLine'),
    ...CART_FIELDS,
  ],
};
