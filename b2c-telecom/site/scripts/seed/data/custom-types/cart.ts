import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { CART_FIELDS } from './fields';

// resourceTypeIds ['order'] covers carts and orders (verified live in G-18).
export const cartType: TypeDraft = {
  key: 'malva-cart',
  name: ls('Malva cart', 'Malva-Warenkorb'),
  description: ls('Serviceability answers and the demo marker of a bundle.', 'Verfügbarkeitsantworten und Demo-Markierung eines Bundles.'),
  resourceTypeIds: ['order'],
  fieldDefinitions: CART_FIELDS,
};
