import { checkoutRoute } from '@/lib/checkout-api';
import { readReview } from '@/lib/ct/checkout';

export const dynamic = 'force-dynamic';

/** The review data; also the window-focus total check of the payment step. */
export async function GET(request: Request) {
  return checkoutRoute(request, {}, async (session, market) => ({ data: { review: await readReview(session, market) } }));
}
