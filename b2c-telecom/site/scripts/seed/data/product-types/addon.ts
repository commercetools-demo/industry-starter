import type { ProductTypeDraft } from '../../types';
import { own, shared } from '../shared/attributes';
import { FAMILIES, SUPPORTED_TECHNOLOGIES } from '../shared/enums';

const required = { isRequired: true };

export const addonType: ProductTypeDraft = {
  key: 'malva-addon',
  name: 'Malva add-on',
  description: 'Descriptive facts of an add-on (streaming, security, protection). Sold through offers (`malva-offer`).',
  attributes: [
    shared('addon-kind', required),
    shared('addon-tag', required),
    own('provider', 'Provider', 'Anbieter', { name: 'text' }, { isRequired: true }),
    own('applies-to-families', 'Applies to families', 'Gilt für Tarifarten', { name: 'set', elementType: { name: 'enum', values: FAMILIES } }, { isRequired: true, isSearchable: true }),
    own('applies-to-technologies', 'Applies to technologies', 'Gilt für Technologien', { name: 'set', elementType: { name: 'enum', values: SUPPORTED_TECHNOLOGIES } }, { isSearchable: true }),
    shared('charge-type', required),
    own('trial-days', 'Trial days', 'Testtage', { name: 'number' }),
    shared('highlights'),
  ],
};
