import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { loadRxFixtures } from '@/lib/ct/fixtures';

export interface Patient {
  /** Opaque id that clinical records link to (never name or email). */
  patientRef: string;
  /** Display name for "Patient: <name>". */
  name: string;
  /** The customer's `fundingScheme` (payer cost-share); absent when the patient has none. */
  fundingScheme?: string;
}

/**
 * The signed-in customer's clinical identity: `custom.fields.patientRef` of the `mlv-patient` type plus the
 * display name. Null when the customer has no patientRef (clinical data is then unreachable for them).
 */
export async function getPatient(customerId: string): Promise<Patient | null> {
  const fixtures = await loadRxFixtures();
  if (fixtures) return fixtures.fixturePatient(customerId);
  try {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    const fields = body.custom?.fields as { patientRef?: unknown; fundingScheme?: unknown } | undefined;
    const ref = fields?.patientRef;
    if (typeof ref !== 'string' || !ref) return null;
    const scheme = typeof fields?.fundingScheme === 'string' && fields.fundingScheme ? fields.fundingScheme : undefined;
    return { patientRef: ref, name: [body.firstName, body.lastName].filter(Boolean).join(' '), ...(scheme ? { fundingScheme: scheme } : {}) };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}
