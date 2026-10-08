import { credentialKey, type Credential } from '@/lib/clinical/types';

/**
 * Credentialed purchase scope (workstream U, Q-065). Pure rules over the credentials a patient holds; the server
 * wrapper (`lib/ct/credentials.ts`) reads them from the `CredentialSource` (F-01). A credential is a scope and a
 * period, not a flag: it must cover the product's control class and be valid on the date of purchase.
 */

export type CredentialCheck = 'OK' | 'NONE' | 'WRONG_SCOPE' | 'EXPIRED' | 'PENDING';

export interface CredentialResult {
  code: CredentialCheck;
  /** The credential that allowed the purchase (only with `OK`, and only for a controlled class). */
  credential?: Credential;
}

/** What is copied onto the order line: the credential's id and its expiry at the time, never a live reference. */
export interface CredentialRecord {
  id: string;
  validTo: string;
}

/** A credential for class A covers class A (a hierarchy of classes is a scheme rule; none exists in the demo). */
const covers = (credentialClass: string, controlClass: string): boolean => credentialClass === controlClass;

/**
 * The answer for one class on one date (`YYYY-MM-DD`). Uncontrolled goods (no class) are always `OK` and need no
 * credential. Otherwise, in order: no credential at all is `NONE`; credentials that exist but none covers the class is
 * `WRONG_SCOPE`; a covering credential that is valid on the date is `OK`; one still awaiting verification (or not yet in
 * force) is `PENDING`; one that has lapsed is `EXPIRED`; a revoked one counts as none.
 */
export function evaluateCredential(credentials: Credential[], controlClass: string | null | undefined, at: string): CredentialResult {
  if (!controlClass) return { code: 'OK' };
  if (credentials.length === 0) return { code: 'NONE' };
  const covering = credentials.filter((c) => covers(c.class, controlClass));
  if (covering.length === 0) return { code: 'WRONG_SCOPE' };
  const valid = covering.find((c) => c.status === 'active' && c.validFrom <= at && at <= c.validTo);
  if (valid) return { code: 'OK', credential: valid };
  if (covering.some((c) => c.status === 'pending' || (c.status === 'active' && c.validFrom > at))) return { code: 'PENDING' };
  if (covering.some((c) => c.status === 'expired' || (c.status === 'active' && c.validTo < at))) return { code: 'EXPIRED' };
  return { code: 'NONE' };
}

export const recordOf = (credential: Credential): CredentialRecord => ({ id: credentialKey(credential.patientRef, credential.class), validTo: credential.validTo });

/** `schedule-iv` -> `Schedule IV` for the requirement text (roman numerals stay upper case). */
export const controlClassLabel = (controlClass: string): string =>
  controlClass
    .split('-')
    .map((word, i) => (/^[ivx]+$/i.test(word) ? word.toUpperCase() : i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
