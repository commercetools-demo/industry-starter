import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { BOOLEAN, NUMBER, STRING, field } from './fields';

export const lineItemType: TypeDraft = {
  key: 'malva-line-item',
  name: ls('Malva line item', 'Malva-Position'),
  description: ls('Links between bundle lines and how a handset is acquired.', 'Verknüpfungen zwischen Bundle-Positionen und Art des Gerätekaufs.'),
  resourceTypeIds: ['line-item', 'custom-line-item'],
  fieldDefinitions: [
    field('parentLineItemId', 'Parent line item id', 'Übergeordnete Position', STRING),
    field('acquisitionMode', 'Acquisition mode', 'Erwerbsart', {
      name: 'Enum',
      values: [
        { key: 'outright', label: 'Outright' },
        { key: 'installments', label: 'Installments' },
        { key: 'lease', label: 'Lease' },
      ],
    }),
    field('acquisitionTermMonths', 'Acquisition term (months)', 'Laufzeit (Monate)', NUMBER),
    field('offerKey', 'Offer key', 'Angebotsschlüssel', STRING),
    field('autoAdded', 'Added automatically', 'Automatisch hinzugefügt', BOOLEAN),
  ],
};
