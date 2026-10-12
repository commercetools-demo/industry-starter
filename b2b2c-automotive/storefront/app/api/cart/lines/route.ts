// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/cart/lines` (workstream L, reused by M and extended by N): adds a sku to the session's cart.
//   body   { sku, quantity (1 to 99), recurrencePolicyKey? }   (cards never send the policy key; the product page does)
//   200    { cartId, count }   count = units in the cart; the cart id is written to the session cookie
//   404    sku not in the store's assortment or no store in the session   422 { error: 'price-unavailable' }   409 after one retry
//   The active vehicle (garage) is recorded on the line as `malva-line` fields (workstream N).
// Client code calls it through `useAddToCart` (hooks/useAddToCart.ts) only.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { addLineToCart } from '@/lib/ct/cart';
import { getShellContext } from '@/lib/ct/shell';
import { getLocale, getSession, updateSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';
import { readGarage } from '@/lib/vehicles/service';

const body = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  recurrencePolicyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{2,256}$/)
    .optional(),
});

export const POST = handle(async (request: Request) => {
  const input = await parseJson(request, body);
  const session = await getSession();
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const { locale, currency, country } = await getLocale();
  const shell = await getShellContext(session.storeKey, locale);
  if (!shell) throw new ApiError(404, 'Not found');
  const scope = getBranchScope(session, shell.branches, shell.retailChannelId);

  // The active vehicle is recorded on the line (`malva-line`); a garage that cannot be read never blocks the add.
  const vehicle = await readGarage()
    .then((garage) => garage.vehicles.find((v) => v.id === garage.activeId))
    .catch(() => undefined);

  const result = await addLineToCart({ storeKey: session.storeKey, locale, currency, country, scope }, session, {
    ...input,
    ...(vehicle ? { vehicle: { fitmentKey: vehicle.fitmentKey, make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine } } : {}),
  });
  await updateSession((s) => ({ ...s, cartId: result.cartId, ...(result.anonymousId ? { anonymousId: result.anonymousId } : {}) }));
  return Response.json({ cartId: result.cartId, count: result.count }, { headers: { 'Cache-Control': 'private, no-store' } });
});
