import type { ProductTypeDraft } from '../../types';
import { own, shared } from '../shared/attributes';
import { OS, PHONE_FAMILY } from '../shared/enums';

const required = { isRequired: true };

// Variants differ by color and memory only. The acquisition mode is not a variant (D-015).
export const deviceType: ProductTypeDraft = {
  key: 'malva-device',
  name: 'Malva handset',
  description: 'Descriptive facts of a handset. Variants are color x memory. Sold through offers (`malva-offer`).',
  attributes: [
    own('brand', 'Brand', 'Marke', { name: 'text' }, { isRequired: true }),
    shared('color', required),
    shared('memory-gb', required),
    own('os', 'Operating system', 'Betriebssystem', { name: 'enum', values: OS }, { isRequired: true }),
    shared('network-generation', required),
    own('compatible-plan-families', 'Compatible plan families', 'Kompatible Tarifarten', { name: 'set', elementType: { name: 'enum', values: PHONE_FAMILY } }, { isRequired: true }),
    shared('highlights'),
  ],
};
