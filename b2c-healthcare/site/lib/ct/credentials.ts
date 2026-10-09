import 'server-only';
import type { CredentialSource } from '@/lib/clinical/types';
import { credentialSource } from '@/lib/ct/clinical-store';
import { loadFundingFixtures } from '@/lib/ct/fixtures';
import { evaluateCredential, type CredentialCheck, type CredentialResult } from '@/lib/funding/credential';

/**
 * Credentialed purchase scope: is the patient allowed to buy this control class on this date? The register
 * is the clinical stand-in's `CredentialSource` (a Custom Object per patient and class, F-01); a real register would
 * replace it behind the same interface. Nothing is cached: the credential is read again at every check, which includes
 * order placement.
 */

async function source(): Promise<CredentialSource> {
  const fixtures = await loadFundingFixtures();
  return fixtures ? fixtures.fixtureCredentialSource : credentialSource;
}

const isoDate = (at: Date): string => at.toISOString().slice(0, 10);

/** The check with the credential that allowed it (to copy its id and expiry onto the line). */
export async function checkCredentialDetailed(patientRef: string, controlClass: string | null | undefined, at: Date = new Date(), src?: CredentialSource): Promise<CredentialResult> {
  if (!controlClass) return { code: 'OK' };
  const credentials = await (src ?? (await source())).listForPatient(patientRef);
  return evaluateCredential(credentials, controlClass, isoDate(at));
}

/** `OK | NONE | WRONG_SCOPE | EXPIRED | PENDING` for the patient, the class and the date. Uncontrolled goods are `OK` without a read. */
export async function checkCredential(patientRef: string, controlClass: string | null | undefined, at: Date = new Date(), src?: CredentialSource): Promise<CredentialCheck> {
  return (await checkCredentialDetailed(patientRef, controlClass, at, src)).code;
}
