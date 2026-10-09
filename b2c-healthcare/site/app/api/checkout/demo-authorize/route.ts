import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { readPaymentCart } from '@/lib/ct/checkout';
import { loadFakePaymentProvider } from '@/lib/ct/fixtures';
import { NO_STORE } from '@/lib/rx-route';

/**
 * POST /api/checkout/demo-authorize `{ decline?: boolean }`: DEMO ONLY. Records an authorization (or a decline) in
 * the in-memory fake provider for the customer's cart at its current total. It exists only where the fake
 * provider is loaded (`MALVA_FIXTURES=1`, never in production); everywhere else it is a plain 404, so the real
 * payment path has no such door. No card data is accepted or stored.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const fake = await loadFakePaymentProvider();
    if (!fake) throw new ApiError(404, 'Not found.');
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as { decline?: unknown } | null;
    const cart = await readPaymentCart(ctx);
    if (!cart || cart.lineCount === 0) throw new ApiError(404, 'Not found.');
    // The card is authorized for what is left after the allowance and the restricted instrument; nothing when that is zero.
    const due = cart.tender?.card ?? cart.total;
    if (due.centAmount === 0) return Response.json({ status: 'authorized' }, { headers: NO_STORE });
    const state = fake.fakePaymentProvider.authorize({ id: cart.id, total: due }, { decline: body?.decline === true });
    return Response.json({ status: state.status }, { headers: NO_STORE });
  });
}
