import { handle, requireCustomer } from '@/lib/api';
import { listOwnPrescriptions } from '@/lib/ct/prescriptions';
import { NO_STORE, requirePatient } from '@/lib/rx-route';

/**
 * GET /api/prescriptions: the signed-in patient's own prescriptions for the quick-picks (RX number and issue date
 * only; medications come from the lookup). Never cached: it is per patient and carries RX numbers.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const patient = await requirePatient(customerId);
    return Response.json({ prescriptions: await listOwnPrescriptions(patient.patientRef) }, { headers: NO_STORE });
  });
}
