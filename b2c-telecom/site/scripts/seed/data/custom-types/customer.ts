import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { BOOLEAN, STRING, field } from './fields';

export const customerType: TypeDraft = {
  key: 'malva-customer',
  name: ls('Malva customer', 'Malva-Kunde'),
  description: ls('Account number and the stub credit decision flag.', 'Kundennummer und Kennzeichen der simulierten Bonitätsprüfung.'),
  resourceTypeIds: ['customer'],
  fieldDefinitions: [
    field('accountNumber', 'Account number', 'Kundennummer', STRING),
    field('creditApproved', 'Credit approved (stub)', 'Bonität bestätigt (Simulation)', BOOLEAN),
    field('demoMarker', 'Demo marker', 'Demo-Markierung', STRING),
  ],
};
