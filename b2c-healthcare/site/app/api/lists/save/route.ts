import { ApiError, handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { saveRxLines } from '@/lib/ct/list-view';
import { listLimitError } from '@/lib/list-route';
import { requirePatient, rxContextOf } from '@/lib/rx-route';

const MAX_LINES = 20;
const REF = /^[\w.-]{1,64}$/;
const LIST_ID = /^[\w-]{1,64}$/;
const DEFAULT_NAME = 'My medicines';

/**
 * POST /api/lists/save { rxNumber | rx, lineRefs[], listId? }: "Save to My medicines" on a prescription card. Only the
 * signed-in patient's own prescription (unknown and foreign numbers are the same 404). Without `listId` the lines go
 * to the default list "My medicines", created on first use. The RX number is in the body only and is never logged.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = await readJsonObject(request);
    const rxNumber = typeof body.rxNumber === 'string' ? body.rxNumber : typeof body.rx === 'string' ? body.rx : '';
    const lineRefs = body.lineRefs;
    if (!rxNumber || rxNumber.length > 40 || !Array.isArray(lineRefs) || lineRefs.length === 0 || lineRefs.length > MAX_LINES || !lineRefs.every((r) => typeof r === 'string' && REF.test(r))) {
      throw new ApiError(400, 'Choose at least one medication to save.');
    }
    if (body.listId !== undefined && (typeof body.listId !== 'string' || !LIST_ID.test(body.listId))) throw new ApiError(400, 'The request could not be processed.');
    const patient = await requirePatient(session.customerId);
    try {
      const result = await saveRxLines(session.customerId, patient, rxNumber, lineRefs as string[], { listId: body.listId as string | undefined, defaultName: DEFAULT_NAME, ctx: rxContextOf(session) });
      if (!result) throw new ApiError(404, 'Prescription not found.');
      return result;
    } catch (error) {
      return listLimitError(error);
    }
  });
}
