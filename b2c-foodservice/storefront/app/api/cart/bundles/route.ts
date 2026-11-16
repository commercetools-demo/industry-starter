// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { LineRejected, addPresetBundle, type PresetBundleInput } from '@/lib/ct/cart';
import { SKU_PATTERN } from '@/lib/ct/inventory';
import { limitClient } from '@/lib/http/limit';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Store keys are seeded keys (`mcf-...`), as for the lines route. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
/** Fields a browser must never send: the price is always computed on the server (D2). */
const PRICE_FIELDS = ['price', 'externalPrice', 'centAmount', 'unitPrice', 'total', 'was', 'save'];

type Parsed = PresetBundleInput | 'subscribe' | null;

function parse(raw: unknown): Parsed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  if (PRICE_FIELDS.some((k) => k in b)) return null;
  if (typeof b.sku !== 'string' || !SKU_PATTERN.test(b.sku)) return null;
  if (typeof b.preset !== 'number' || !Number.isInteger(b.preset) || b.preset < 0 || b.preset > 19) return null;
  if (typeof b.quantity !== 'number' || !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 99) return null;
  if (b.machineSku !== undefined && (typeof b.machineSku !== 'string' || !SKU_PATTERN.test(b.machineSku))) return null;
  if (b.fulfilment === 'subscribe') return 'subscribe';
  if (b.fulfilment !== 'delivery' && b.fulfilment !== 'collect') return null;
  if (b.fulfilment === 'collect' && (typeof b.storeKey !== 'string' || !KEY_PATTERN.test(b.storeKey))) return null;
  return {
    sku: b.sku,
    preset: b.preset,
    quantity: b.quantity,
    fulfilment: b.fulfilment,
    ...(typeof b.machineSku === 'string' ? { machineSku: b.machineSku } : {}),
    ...(b.fulfilment === 'collect' && typeof b.storeKey === 'string' ? { storeKey: b.storeKey } : {}),
  };
}

/**
 * POST /api/cart/bundles { sku, preset (0..19), quantity (1..99), machineSku?, fulfilment: 'delivery' | 'collect', storeKey? }
 * -> 200 { cart: CartSummary }. The bundle's parts are one bag row for the shopper (workstream V, D5).
 * Errors: 400 validation_failed (bad body, or any price field), 404 not_found (not a preset bundle), 422
 * bundle_preset_unavailable (`reason`), 422 bundle_not_subscribable (fulfilment subscribe), 400 collect_not_available_in_market,
 * 400 unknown_store, 409 quantity_exceeds_stock or not_available_for_collection (`available`). The price is computed on the server.
 */
export const POST = handle('/api/cart/bundles', async (req) => {
  const limited = limitClient(req, 'cart-bundles', { limit: 200, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  const input = parse(await req.json().catch(() => null));
  if (input === null) return jsonError('validation_failed', 400);
  if (input === 'subscribe') return domainError('bundle_not_subscribable', 422);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    const { cart, session: next } = await addPresetBundle(session, market, input);
    return setSessionCookie(
      NextResponse.json({ cart }, { headers: { 'Cache-Control': 'no-store' } }),
      await createSessionToken(next),
    );
  } catch (e) {
    if (e instanceof LineRejected) return domainError(e.code, e.status, e.extra);
    throw e;
  }
});
