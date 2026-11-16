// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductProjection } from '@commercetools/platform-sdk';

const state = vi.hoisted(() => ({ projection: null as unknown, view: null as unknown }));

vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('@/lib/ct/product-detail', () => ({ getProductBySku: async () => state.projection }));
vi.mock('@/lib/ct/preset-bundles', () => ({ getBundleView: async () => state.view }));
// The pattern only; the module also loads the commercetools client (needs the env).
vi.mock('@/lib/ct/inventory', () => ({ SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/ }));

import { GET } from './route';

const ctx = (sku: string) => ({ params: Promise.resolve({ sku }) });
const projectionOfType = (key: string) => ({ id: 'p1', productType: { obj: { key } } }) as unknown as ProductProjection;

beforeEach(() => {
  state.view = { productId: 'p1', sku: '998674532', presets: [] };
});

describe('GET /api/preset-bundles/[sku] (V-07)', () => {
  it('answers 200 with the bundle for a preset bundle product', async () => {
    state.projection = projectionOfType('malva-coffee-machine-bundle');
    const res = await GET(new Request('https://shop.test/api/preset-bundles/998674532'), ctx('998674532'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bundle: state.view });
  });

  it('answers 404 for a normal product', async () => {
    state.projection = projectionOfType('mcf-pods');
    const res = await GET(new Request('https://shop.test/api/preset-bundles/MCF-X'), ctx('MCF-X'));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('answers 404 for an unknown SKU', async () => {
    state.projection = null;
    const res = await GET(new Request('https://shop.test/api/preset-bundles/nope'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('answers 404 for a malformed SKU without reading anything', async () => {
    state.projection = projectionOfType('malva-coffee-machine-bundle');
    const res = await GET(new Request('https://shop.test/api/preset-bundles/a%20b'), ctx('a b'));
    expect(res.status).toBe(404);
  });
});
