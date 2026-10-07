import type { TypeDraft } from '../../types';
import { ls } from '../catalog-types';
import { BOOLEAN, DATETIME, STRING, field } from './fields';

/** Workstream R: sessions signed in before this instant are refused (set when the password is reset). */
export const sessionsValidAfterField = field('sessionsValidAfter', 'Sessions valid after', 'Sitzungen gültig ab', DATETIME);

export const customerType: TypeDraft = {
  key: 'malva-customer',
  name: ls('Malva customer', 'Malva-Kunde'),
  description: ls('Account number, the stub credit decision flag and the session cut-off of a password reset.', 'Kundennummer, Kennzeichen der simulierten Bonitätsprüfung und Sitzungs-Stichzeit nach einem Passwort-Reset.'),
  resourceTypeIds: ['customer'],
  fieldDefinitions: [
    field('accountNumber', 'Account number', 'Kundennummer', STRING),
    field('creditApproved', 'Credit approved (stub)', 'Bonität bestätigt (Simulation)', BOOLEAN),
    field('demoMarker', 'Demo marker', 'Demo-Markierung', STRING),
    sessionsValidAfterField,
  ],
};
