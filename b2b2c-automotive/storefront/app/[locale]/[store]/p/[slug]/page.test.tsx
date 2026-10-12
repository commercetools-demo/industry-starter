// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detail, summary } from '@/components/product/detail/test-fixtures';
import type { ProductPageResult } from '@/lib/product/load';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/product/load', () => ({ getProductPage: load, DEFAULT_RETURN_DAYS: 30 }));
vi.mock('@/lib/product/origin', () => ({ requestOrigin: async () => 'https://shop.example' }));
vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default as unknown as Record<string, Record<string, string>>;
  return {
    setRequestLocale: () => undefined,
    getTranslations: async ({ namespace }: { namespace: string }) => (key: string, values?: Record<string, string>) =>
      (messages[namespace]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? ''),
  };
});
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/mau-reseller-north/p/x',
}));

import { ProductPage } from '@/components/product/ProductPage';
import Page, { generateMetadata } from './page';

const params = (slug: string) => Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north', slug });
const search = Promise.resolve({});
const ok = (over = {}): ProductPageResult => ({
  kind: 'ok',
  product: detail({ recurringEligible: false }),
  related: [summary()],
  reviews: [],
  reviewForm: null,
  branch: { name: 'Küstenwerk Hamburg-Harburg', address: { street: 'Harburger Ring 1', postalCode: '21073', city: 'Hamburg' }, pickup: 'today' },
  canChangeStore: true,
  shipDays: { min: 2, max: 3 },
  sellerName: 'Küstenwerk Autoteile',
  returnDays: 30,
  subscriptionsEnabled: true,
  alternativesHref: '/mau-reseller-north/category/brakes',
  ...over,
});

beforeEach(() => load.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('product route', () => {
  it('unknown slug is not-found', async () => {
    load.mockResolvedValue({ kind: 'not-found' });
    await expect(ProductPage({ locale: 'en-US', store: 'mau-reseller-north', slug: 'nope' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('withdrawn product is not-found', async () => {
    // A product that is not in the store's assortment is `null` from the in-store read: the loader answers not-found.
    load.mockResolvedValue({ kind: 'not-found' });
    await expect(ProductPage({ locale: 'en-US', store: 'mau-reseller-north', slug: 'withdrawn-part' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ storeKey: 'mau-reseller-north', slug: 'withdrawn-part' }));
  });

  it('an unknown locale is not-found', async () => {
    await expect(Page({ params: Promise.resolve({ locale: 'fr-FR', store: 's', slug: 'x' }), searchParams: search })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('metadata uses name and part number', async () => {
    load.mockResolvedValue(ok());
    const m = await generateMetadata({ params: params('vektra-front-brake-pad-set'), searchParams: search });
    expect(m.title).toBe('Vektra front brake pad set (BP-41001)');
    expect(m.alternates?.canonical).toBe('https://shop.example/en-US/mau-reseller-north/p/vektra-front-brake-pad-set');
  });

  it('metadata of a missing product is empty', async () => {
    load.mockResolvedValue({ kind: 'not-found' });
    expect(await generateMetadata({ params: params('nope'), searchParams: search })).toEqual({});
  });

  it('passes ?sku= to the loader', async () => {
    load.mockResolvedValue({ kind: 'not-found' });
    await generateMetadata({ params: params('x'), searchParams: Promise.resolve({ sku: 'V2' }) });
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ sku: 'V2' }));
  });

  it('renders the page parts and a JSON-LD script that cannot close itself', async () => {
    installFakeApi(stateOf('volkswagen.golf.2016.2-0-tdi'));
    load.mockResolvedValue(ok({ product: detail({ name: 'Pads </script><b>x</b>' }) }));
    const element = await ProductPage({ locale: 'en-US', store: 'mau-reseller-north', slug: 'x' });
    const { container } = renderVehicle(element as never, { garage: stateOf('volkswagen.golf.2016.2-0-tdi'), locale: 'en-US' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pads </script><b>x</b>');
    expect(screen.getByRole('heading', { name: 'Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Often bought together' })).toBeInTheDocument();
    const ld = container.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
    expect(ld.textContent).not.toContain('<');
    const data = JSON.parse(ld.textContent ?? '{}') as { '@type': string; offers: { priceCurrency: string }; name: string };
    expect(data['@type']).toBe('Product');
    expect(data.offers.priceCurrency).toBe('USD');
    expect(data.name).toBe('Pads </script><b>x</b>');
  });

  it('json-ld has no offers without a price', async () => {
    installFakeApi(stateOf('volkswagen.golf.2016.2-0-tdi'));
    load.mockResolvedValue(ok({ product: detail({ price: null }) }));
    const element = await ProductPage({ locale: 'en-US', store: 'mau-reseller-north', slug: 'x' });
    const { container } = renderVehicle(element as never, { garage: stateOf('volkswagen.golf.2016.2-0-tdi'), locale: 'en-US' });
    const ld = container.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
    expect(JSON.parse(ld.textContent ?? '{}')).not.toHaveProperty('offers');
  });
});
