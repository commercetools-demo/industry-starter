// npx tsx scripts/demo/place-test-order.ts --confirm-project spec-test-b2c-telecom --cart-id <cartId>
// Workstream U, for the Chrome checks of the confirmation page: orders an existing cart exactly as the hosted Checkout does (a generated
// MLV- order number, payment state Paid) and prints ONLY the order number. The order is left without its schedule, label snapshot and
// service start on purpose: the confirmation page finalizes it on its first view (the lazy path, C-U-18). Build the cart first through the
// app (My bundle) or the seed QA scripts; the cart needs a customer (recurring lines) and a shipping address (G findings).
// Allow-listed project only (D-054). Never sets a payment strategy (L finding: the order would be refused without an allocation).
import { generateOrderNumber } from '../../lib/checkout/orderNumber';
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../seed/cli';
import { EXIT } from '../seed/config';
import { getAdminApi, loadSeedEnv, type CtApi } from '../seed/lib';

interface CartRow {
  id: string;
  version: number;
  cartState?: string;
}

export class PlaceOrderUsageError extends Error {}

/** Orders the cart; returns the order number. */
export async function placeTestOrder(api: CtApi, cartId: string, orderNumber: string = generateOrderNumber()): Promise<string> {
  const cart = (await api.get(`carts/${cartId}`)) as CartRow | null;
  if (!cart) throw new PlaceOrderUsageError(`No cart with id ${cartId}.`);
  if (cart.cartState !== 'Active') throw new PlaceOrderUsageError(`Cart ${cartId} is ${cart.cartState ?? 'not active'}; only an Active cart can be ordered.`);
  await api.post('orders', { cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber, paymentState: 'Paid' });
  return orderNumber;
}

export async function main(argv: string[], deps: { api?: CtApi; source?: Record<string, string | undefined>; log?: Log } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'cart-id']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const cartId = args.values.get('cart-id');
    if (!cartId) throw new PlaceOrderUsageError('Usage: --confirm-project <key> --cart-id <cartId>');
    log(await placeTestOrder(api, cartId));
    return EXIT.OK;
  } catch (err) {
    if (err instanceof PlaceOrderUsageError) {
      log(err.message);
      return EXIT.FAILED;
    }
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
