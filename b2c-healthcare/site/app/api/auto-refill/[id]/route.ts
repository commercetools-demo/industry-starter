import { ApiError, handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { previewDecision } from '@/lib/ct/auto-refill-run';
import { cancelRecurring, changeScheduleRecurring, getOwnRecurring, pauseRecurring, resumeRecurring, skipNextRecurring } from '@/lib/ct/recurring';
import { lastRunsOf } from '@/lib/ct/refill-log';
import { mapRefill } from '@/lib/mappers/recurring';
import { localeOfSession } from '@/lib/order-route';
import { refillErrorResponse, refillNotFound } from '@/lib/refill-route';
import { CADENCES, type Cadence, type RefillAction } from '@/lib/refill-types';

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS: readonly RefillAction[] = ['pause', 'resume', 'skip', 'cancel'];

/** Which states each action may start from (a state change the platform would refuse is a readable 409 here). */
const FROM: Record<RefillAction, readonly string[]> = { pause: ['Active'], resume: ['Paused', 'Failed'], skip: ['Active'], cancel: ['Active', 'Paused', 'Failed'] };

const invalidState = () => Response.json({ code: 'INVALID_STATE', error: 'That is not possible for this auto-refill right now.' }, { status: 409 });

/**
 * POST /api/auto-refill/:id { action: 'pause' | 'resume' | 'skip' | 'cancel' }. Pause stops further orders; resume
 * re-checks the prescription first (409 `RESUME_BLOCKED` with the reason when it has lapsed or has no refills left);
 * skip leaves out only the next order; cancel ends the series. A foreign or unknown id answers the same 404.
 */
export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const body = await readJsonObject(request);
    const action = body.action;
    if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) throw new ApiError(400, 'The request could not be processed.');
    const refill = await getOwnRecurring(id, session.customerId);
    if (!refill) throw refillNotFound();
    if (!FROM[action as RefillAction].includes(refill.recurringOrderState)) return invalidState();
    try {
      if (action === 'resume') {
        const provider = await getPaymentProvider();
        const decision = await previewDecision(refill, new Date(), (customerId) => provider.listStoredMethods(customerId));
        if (!decision.run && decision.reason !== 'ceiling') return Response.json({ code: 'RESUME_BLOCKED', reason: decision.reason, error: 'This auto-refill cannot be resumed right now.' }, { status: 409 });
      }
      const updated =
        action === 'pause' ? await pauseRecurring(id) : action === 'resume' ? await resumeRecurring(id) : action === 'skip' ? await skipNextRecurring(id) : await cancelRecurring(id);
      const run = (await lastRunsOf([id]).catch(() => new Map())).get(id) ?? null;
      return mapRefill(updated, localeOfSession(session), run);
    } catch (error) {
      return refillErrorResponse(error);
    }
  });
}

/** PATCH /api/auto-refill/:id { cadence }: changes the cadence in place; it applies from the next generated order. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const body = await readJsonObject(request);
    const cadence = body.cadence;
    if (typeof cadence !== 'string' || !(CADENCES as readonly string[]).includes(cadence)) throw new ApiError(400, 'Choose how often.');
    const refill = await getOwnRecurring(id, session.customerId);
    if (!refill) throw refillNotFound();
    if (!['Active', 'Paused'].includes(refill.recurringOrderState)) return invalidState();
    try {
      const updated = await changeScheduleRecurring(id, cadence as Cadence);
      const run = (await lastRunsOf([id]).catch(() => new Map())).get(id) ?? null;
      return mapRefill(updated, localeOfSession(session), run);
    } catch (error) {
      return refillErrorResponse(error);
    }
  });
}
