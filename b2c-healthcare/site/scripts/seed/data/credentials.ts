import { credentialKey, type Credential } from '../../../lib/clinical/types';
import { JORDAN, SAM } from './patients';

/**
 * Credentialed purchase scope demo (workstream U): Sam holds a valid credential for schedule IV, Jordan has submitted
 * one that is still being verified, Alex has none.
 */
export const CREDENTIALS: Credential[] = [
  { patientRef: SAM.patientRef, class: 'schedule-iv', issuer: 'Malva Demo Credentialing', validFrom: '2026-01-01', validTo: '2027-01-01', status: 'active' },
  { patientRef: JORDAN.patientRef, class: 'schedule-iv', issuer: 'Malva Demo Credentialing', validFrom: '2026-10-01', validTo: '2027-10-01', status: 'pending' },
];

export const credentialObjectKey = (c: Credential) => credentialKey(c.patientRef, c.class);
