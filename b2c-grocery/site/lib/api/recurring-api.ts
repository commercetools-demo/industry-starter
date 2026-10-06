import 'server-only';
import type { NextResponse } from 'next/server';
import {
  RecurringOrderLineNotFoundError,
  RecurringOrderNotFoundError,
  RecurringOrderStateError,
  UnknownPolicyError,
} from '@/lib/ct/recurring-orders';
import { privateJson } from './private-json';

/** Every recurring route answers like a missing route while `FEATURE_SUBSCRIPTIONS` is off (checked before the session). */
export const subscriptionsOff = (): NextResponse => privateJson({ error: 'NOT_FOUND' }, { status: 404 });

/**
 * Maps a failed recurring call: not theirs or missing 404, a state that does not allow the action 409, an unknown policy
 * 400, a second version conflict 409, the rest 500. Never logs more than the message.
 */
export function recurringFailure(e: unknown): NextResponse {
  if (e instanceof RecurringOrderNotFoundError) return privateJson({ error: 'RECURRING_ORDER_NOT_FOUND' }, { status: 404 });
  if (e instanceof RecurringOrderLineNotFoundError) return privateJson({ error: 'LINE_NOT_FOUND' }, { status: 404 });
  if (e instanceof RecurringOrderStateError) return privateJson({ error: 'INVALID_STATE', state: e.state }, { status: 409 });
  if (e instanceof UnknownPolicyError) return privateJson({ error: 'INVALID_POLICY' }, { status: 400 });
  const status = typeof e === 'object' && e !== null ? (e as { statusCode?: unknown }).statusCode : undefined;
  console.error('Recurring order request failed', e instanceof Error ? e.message : e);
  return privateJson({ error: 'RECURRING_ERROR' }, { status: status === 409 ? 409 : 500 });
}
