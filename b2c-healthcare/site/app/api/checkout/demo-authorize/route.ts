import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { readPaymentCart } from '@/lib/ct/checkout';
import { loadCheckoutFixtures, loadFakePaymentProvider } from '@/lib/ct/fixtures';
import { NO_STORE } from '@/lib/rx-route';

/**
 * POST /api/checkout/demo-authorize `{ decline?: boolean }`: DEMO ONLY. Stands in for the full Checkout: records a (possibly
 * declined) demo authorization for what the card must pay and, when authorized, "creates the order" in the fixture shop,
 * exactly where commercetools Checkout would. It answers `{ status, orderId }`; the page then calls the same completion
 * callback as with the real SDK (`/api/checkout/complete`), which runs the domain logic. It exists only where the fake
 * provider is loaded (`MALVA_FIXTURES=1`, never in production); everywhere else it is a plain 404. No card data exists.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const fake = await loadFakePaymentProvider();
    const fixtures = await loadCheckoutFixtures();
    if (!fake || !fixtures) throw new ApiError(404, 'Not found.');
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as { decline?: unknown } | null;
    const cart = await readPaymentCart(ctx);
    if (!cart || cart.lineCount === 0) throw new ApiError(404, 'Not found.');
    const due = cart.tender?.card ?? cart.total;
    const state = fake.fakePaymentProvider.authorize({ id: cart.id, total: due }, { decline: body?.decline === true });
    if (state.status !== 'authorized') return Response.json({ status: state.status }, { headers: NO_STORE });
    const order = fixtures.createFixtureOrder(ctx.customerId);
    if (!order) throw new ApiError(409, 'Prepare the checkout first.');
    return Response.json({ status: 'authorized', orderId: order.id }, { headers: NO_STORE });
  });
}
