import { credentialKey, type Credential } from '../../../lib/clinical/types';
import { SAM } from './patients';

/** Sam holds a credential for one controlled class (schedule IV), so the controlled-substance demo can show an eligible patient. */
export const CREDENTIALS: Credential[] = [
  { patientRef: SAM.patientRef, class: 'schedule-iv', issuer: 'Malva Demo Credentialing', validFrom: '2026-01-01', validTo: '2027-01-01', status: 'active' },
];

export const credentialObjectKey = (c: Credential) => credentialKey(c.patientRef, c.class);
