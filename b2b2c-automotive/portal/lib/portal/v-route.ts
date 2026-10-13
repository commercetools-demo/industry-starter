// Small helpers of V's seller routes (customers, subscriptions, returns, reviews): the display locale of a read, the acting user and the
// four subscription action routes. Authorization always comes first (`authorizeSeller` / `authorizedBody`), then the service call.
import 'server-only';
import { z } from 'zod';
import { runSubscriptionAction } from '@/lib/ct/seller/subscriptions';
import type { SubscriptionAction } from '@/lib/v-types';
import { json } from './route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, StoreKey } from './seller-route';
import { pathParam, type Params } from './w-route';

export type DisplayLocale = 'de-DE' | 'en-US';

/** `?locale=` of a read: only used to pick the language of product names; anything else is en-US. */
export function localeParam(request: Request): DisplayLocale {
  return new URL(request.url).searchParams.get('locale') === 'de-DE' ? 'de-DE' : 'en-US';
}

const Plain = z.object({ storeKey: StoreKey }).strict();
const Cancel = z.object({ storeKey: StoreKey, confirm: z.literal(true) }).strict();

/** POST /api/seller/subscriptions/[id]/<action>: the target state comes from the action word only; the body has no other field. */
export function subscriptionActionRoute(action: SubscriptionAction) {
  return sellerHandle(async (request: Request, context: Params<'id'>) => {
    const body = await authorizedBody(request, (action === 'cancel' ? Cancel : Plain) as z.ZodType<{ storeKey: string }>, 'subscriptions.manage');
    const id = await pathParam(context, 'id');
    const session = await authorizeSeller(body.storeKey, 'subscriptions.manage');
    return json(await runSubscriptionAction(body.storeKey, id, action, session.customerId as string));
  });
}
