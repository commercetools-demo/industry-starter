import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { recurringFailure, subscriptionsOff } from '@/lib/api/recurring-api';
import { readJson } from '@/lib/cart-api';
import { isRecurrencePolicyKey, subscriptionsEnabled } from '@/lib/config/features';
import { cancel, pause, resume, setCadence, setQuantity } from '@/lib/ct/recurring-orders';
import { getMarket, getSession } from '@/lib/session';

type Context = { params: Promise<{ id: string }> };

const bad = (error: string) => privateJson({ error }, { status: 400 });

/**
 * Changes one of the customer's own recurring orders. Body `{ action: 'set-cadence' | 'set-quantity' | 'pause' | 'resume' | 'cancel',
 * policyKey?, lineId?, quantity? }`. Answers `{ recurringOrder }`, the refreshed summary. A recurring order that is not theirs
 * answers exactly like a missing one (404).
 */
export async function PATCH(request: Request, { params }: Context) {
  if (!subscriptionsEnabled()) return subscriptionsOff();
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { id } = await params;
  const body = await readJson(request);
  const { action, policyKey, lineId, quantity } = body;

  // Validate the whole request before touching commercetools.
  if (action === 'set-cadence' && !isRecurrencePolicyKey(policyKey)) return bad('INVALID_POLICY');
  if (action === 'set-quantity') {
    if (typeof lineId !== 'string' || lineId === '') return bad('INVALID_LINE');
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return bad('INVALID_QUANTITY');
  }
  if (!['set-cadence', 'set-quantity', 'pause', 'resume', 'cancel'].includes(String(action))) return bad('INVALID_ACTION');

  try {
    const { locale } = await getMarket();
    const recurringOrder =
      action === 'set-cadence'
        ? await setCadence(id, customerId, policyKey as string, locale)
        : action === 'set-quantity'
          ? await setQuantity(id, customerId, lineId as string, quantity as number, locale)
          : action === 'pause'
            ? await pause(id, customerId, locale)
            : action === 'resume'
              ? await resume(id, customerId, locale)
              : await cancel(id, customerId, locale);
    return privateJson({ recurringOrder });
  } catch (e) {
    return recurringFailure(e);
  }
}
