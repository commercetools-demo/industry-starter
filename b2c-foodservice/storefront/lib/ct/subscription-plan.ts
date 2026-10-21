import 'server-only';
import type { RecurringOrder, RecurringOrderUpdateAction } from '@commercetools/platform-sdk';
import type { DomainErrorCode } from '@/lib/api-domain';
import { mapSubscriptionState } from '@/lib/mappers/recurring-order';
import type { SubscriptionAction } from '@/lib/types';

/** A change the subscription cannot take, with a domain code the account explains (never commercetools text). */
export class SubscriptionRejected extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'SubscriptionRejected';
  }
}

/** Ids of the platform are UUIDs; the pattern is looser only so the local mock's ids pass. Ids are never put into a predicate. */
export const UUID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;

/** Parses and allow-lists a request body. Anything else is `invalid_request`; client-supplied versions and ids are never read. */
export function parseSubscriptionAction(body: unknown): SubscriptionAction {
  if (typeof body !== 'object' || body === null) throw new SubscriptionRejected('invalid_request', 400);
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'pause':
    case 'resume':
    case 'cancel':
    case 'skip':
      return { action: b.action };
    case 'setInterval':
      if (typeof b.recurrencePolicyId !== 'string' || !UUID.test(b.recurrencePolicyId)) throw new SubscriptionRejected('invalid_request', 400);
      return { action: 'setInterval', recurrencePolicyId: b.recurrencePolicyId };
    default:
      throw new SubscriptionRejected('invalid_request', 400);
  }
}

/**
 * The single update action for a request, after the state rules (documented: a schedule can be set only on an Active
 * recurring order with no active skip). Pure. Skip uses a cumulative Counter: the platform tracks `totalToSkip` and
 * `skipped`, so one more skip means `totalToSkip + 1` (N-02, to be confirmed live: M-N-04).
 */
export function planAction(raw: RecurringOrder, req: SubscriptionAction): RecurringOrderUpdateAction {
  const state = mapSubscriptionState(raw.recurringOrderState);
  const counter = raw.skipConfiguration?.type === 'Counter' ? raw.skipConfiguration : undefined;
  const pendingSkips = counter ? Math.max(0, counter.totalToSkip - counter.skipped) : 0;
  const invalid = () => new SubscriptionRejected('invalid_state', 422);
  switch (req.action) {
    case 'pause':
      if (state !== 'active') throw invalid();
      return { action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } };
    case 'resume':
      if (state !== 'paused') throw invalid();
      return { action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } };
    case 'cancel':
      if (state === 'canceled' || state === 'expired') throw invalid();
      return { action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } };
    case 'skip':
      if (state !== 'active' || pendingSkips > 0) throw invalid();
      return {
        action: 'setOrderSkipConfiguration',
        skipConfigurationInputDraft: { type: 'Counter', totalToSkip: (counter?.totalToSkip ?? 0) + 1 },
      };
    case 'setInterval':
      if (state !== 'active' || pendingSkips > 0) throw invalid();
      return { action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', id: req.recurrencePolicyId } };
  }
}
