import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { BOOLEAN, DATE, NUMBER, STRING, field } from './fields';

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
    // Workstream Q: what happens at the end of the term, until when, and the financing decision of record.
    field('acquisitionEndOfTerm', 'End of term', 'Ende der Laufzeit', {
      name: 'Enum',
      values: [
        { key: 'owned', label: 'Owned from day one' },
        { key: 'owned-after-final-payment', label: 'Owned after the final payment' },
        { key: 'return', label: 'Return at the end' },
      ],
    }),
    field('acquisitionEndDate', 'End date of the term', 'Enddatum der Laufzeit', DATE),
    field('financingDecisionId', 'Financing decision id', 'Kennung der Finanzierungsentscheidung', STRING),
  ],
};
