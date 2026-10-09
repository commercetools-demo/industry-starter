import 'server-only';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import type { RefillOption } from '@/components/auto-refill/EnableRefillForm';
import type { Patient } from '@/lib/ct/patient';
import { findOwnPrescription, getRxView, listOwnPrescriptions, type RxContext } from '@/lib/ct/prescriptions';

const MAX_PRESCRIPTIONS = 10;

/**
 * What the "Set up auto-refill" form offers: for each of the patient's own prescriptions, the lines that can be
 * dispensed today (N rules via `getRxView`; a line with no refills left, an expired prescription or no stock is not
 * offered). The server checks again when the form is submitted.
 */
export async function refillOptions(patient: Patient, ctx: RxContext): Promise<RefillOption[]> {
  const picks = (await listOwnPrescriptions(patient.patientRef)).slice(0, MAX_PRESCRIPTIONS);
  const options: RefillOption[] = [];
  for (const pick of picks) {
    const rx = await findOwnPrescription(patient.patientRef, pick.number);
    if (!rx) continue;
    const view = await getRxView(patient, rx, ctx);
    const lines = view.lines.filter((l) => l.selectable).map((l) => ({ lineRef: l.lineRef, name: l.name }));
    if (lines.length > 0) options.push({ number: view.number, lines });
  }
  return options;
}

/** Whether the customer has a saved payment method: null when the payment service cannot be read right now. */
export async function hasSavedMethod(customerId: string, provider: () => Promise<Pick<PaymentProvider, 'listStoredMethods'>>): Promise<boolean | null> {
  try {
    return (await (await provider()).listStoredMethods(customerId)).length > 0;
  } catch {
    return null;
  }
}
