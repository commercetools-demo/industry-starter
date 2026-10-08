import { ApiError, handle } from '@/lib/api';
import { getSlotDays } from '@/lib/ct/doctor-slots';
import { MODES, type Mode } from '@/lib/clinical/slots';

// Availability changes with every booking: never prerendered, never cached by the framework or a CDN.
export const dynamic = 'force-dynamic';

const KEY = /^[\w-]{1,100}$/;

/**
 * GET /api/doctors/:key/slots?mode=remote|office: the next 7 days with the free times (`SlotsResponse`).
 * Public (guests book too). The booking panel reads it on every open and after a "slot taken" answer.
 */
export async function GET(request: Request, context: { params: Promise<{ key: string }> }): Promise<Response> {
  return handle(async () => {
    const { key } = await context.params;
    const mode = new URL(request.url).searchParams.get('mode');
    if (!KEY.test(key) || !MODES.includes(mode as Mode)) throw new ApiError(400, 'The request could not be processed.');
    const days = await getSlotDays(key, mode as Mode);
    if (!days) throw new ApiError(404, 'Not found.');
    return Response.json(days, { headers: { 'cache-control': 'no-store' } });
  });
}
