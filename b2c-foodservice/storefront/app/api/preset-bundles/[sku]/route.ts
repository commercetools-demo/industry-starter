// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { handle, jsonError } from '@/lib/api';
import { getBundleView } from '@/lib/ct/preset-bundles';
import { SKU_PATTERN } from '@/lib/ct/inventory';
import { getProductBySku } from '@/lib/ct/product-detail';
import { shapeOf } from '@/lib/product/variant-config';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/preset-bundles/<sku>
 * 200 { bundle } with the market's view (`BundleView`, or null when the bundle cannot be read). 404 not_found for a SKU
 * that is not a preset bundle (or a malformed one). Prices follow the session market, so the answer is never cached.
 */
export const GET = handle('/api/preset-bundles/[sku]', async (_req, ctx) => {
  const { sku } = await ctx.params;
  if (!SKU_PATTERN.test(sku)) return jsonError('not_found', 404);
  const market = await getMarket();
  const projection = await getProductBySku(sku, market);
  if (!projection || shapeOf(projection.productType?.obj?.key) !== 'presetBundle') return jsonError('not_found', 404);
  const bundle = await getBundleView(sku, projection, market);
  return Response.json({ bundle }, { headers: { 'Cache-Control': 'private, no-store' } });
});
