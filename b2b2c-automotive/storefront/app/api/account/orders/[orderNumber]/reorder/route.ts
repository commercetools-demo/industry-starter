// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/account/orders/{orderNumber}/reorder` -> `{ added, skipped, count }` (workstream Q-06). Adds the lines of the customer's own order to the
// session cart (one-time, at today's price and stock; a line that can no longer be bought is skipped and counted). The order must be the customer's.
import { accountHandle, accountSession, AccountError, NO_STORE } from '@/lib/account/errors';
import { addLineToCart } from '@/lib/ct/cart';
import { getAccountOrder } from '@/lib/ct/account-orders';
import { getShellContext } from '@/lib/ct/shell';
import { getLocale, updateSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';

export const POST = accountHandle(async (_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  const session = await accountSession();
  const order = await getAccountOrder(session.storeKey, session.customerId, orderNumber);
  if (!order) throw new AccountError('not-found', 404);
  const { locale, currency, country } = await getLocale();
  const shell = await getShellContext(session.storeKey, locale);
  if (!shell) throw new AccountError('not-found', 404);
  const scope = getBranchScope(session, shell.branches, shell.retailChannelId);

  let cart: { cartId?: string; count: number } = { count: 0 };
  let current = { cartId: session.cartId, customerId: session.customerId, anonymousId: session.anonymousId };
  let added = 0;
  let skipped = 0;
  for (const line of order.lineItems) {
    const sku = line.variant.sku;
    if (!sku) {
      skipped += 1;
      continue;
    }
    try {
      const result = await addLineToCart({ storeKey: session.storeKey, locale, currency, country, scope }, current, { sku, quantity: Math.min(line.quantity, 99) });
      cart = { cartId: result.cartId, count: result.count };
      current = { ...current, cartId: result.cartId };
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  if (cart.cartId) await updateSession((s) => ({ ...s, cartId: cart.cartId }));
  return Response.json({ added, skipped, count: cart.count }, { headers: NO_STORE });
});
