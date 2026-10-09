import { handle, requireCustomer } from '@/lib/api';
import { getAllowanceView } from '@/lib/ct/allowance';
import { getPatient } from '@/lib/ct/patient';

/**
 * GET /api/account/allowance: the signed-in member's allowance for this cycle (balance, what lapses and when), or `null`
 * for a member without one. This is the ONLY allowance endpoint and it only reads. An allowance is not cash: it is spent
 * by an order, before any other payment, and nothing can withdraw it or move it to another member. Every other method
 * answers 405 with that reason, and no withdraw or transfer route exists (a test walks `app/api` to keep it that way).
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    const patient = await getPatient(customerId);
    return Response.json(patient ? await getAllowanceView(patient.patientRef) : null);
  });
}

const refused = (): Promise<Response> =>
  handle(async () => {
    await requireCustomer();
    return Response.json({ error: 'An allowance cannot be withdrawn or transferred. It can only be spent on an order.', code: 'ALLOWANCE_NOT_CASH' }, { status: 405, headers: { allow: 'GET' } });
  });

export const POST = refused;
export const PUT = refused;
export const PATCH = refused;
export const DELETE = refused;
