// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { PuckData } from '@commercetools-demo/puck-types';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageContext } from '@/context/GarageProvider';
import enUS from '@/messages/en-US.json';
import { homeData, product } from '@/test/home';
import { installFakeApi } from '@/test/vehicle';

class NotFound extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ namespace }: { namespace: string }) => {
    const { createTranslator } = await import('next-intl');
    return createTranslator({ locale: 'en-US', messages: enUS, namespace: namespace as 'home' });
  },
}));
vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
const getHomeData = vi.hoisted(() => vi.fn());
const getPublishedPage = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/home', () => ({ getHomeData }));
vi.mock('@/lib/contentools/puck', () => ({ getPublishedPage, HOME_SLUG: '/home' }));
vi.mock('@/lib/contentools/project-key', () => ({ getProjectKey: () => 'proj-1' }));

import StoreHome, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north' });
const published = { content: [{ type: 'PromoBanner', props: { id: 'p', title: 'Published promo', text: 'From Contentools', tone: 'brand' } }], root: { props: {} } } as unknown as PuckData;
const publishedWithHero = { content: [{ type: 'AutomotiveHero', props: { id: 'h', showFinder: false } }], root: { props: {} } } as unknown as PuckData;
const popular = Array.from({ length: 4 }, (_, i) => ({ product: product({ id: `p${i}`, name: `Part ${i}`, sku: `S${i}`, slug: `s${i}` }), fit: 'unknown' as const }));

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={enUS}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <GarageContext.Provider value={{ lookupEnabled: false }}>{children}</GarageContext.Provider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
}
async function renderPage() {
  render(await StoreHome({ params }), { wrapper: Providers });
}

beforeEach(() => {
  vi.resetAllMocks();
  installFakeApi();
  getHomeData.mockResolvedValue(homeData({ popular }));
  getPublishedPage.mockResolvedValue(null);
});

describe('Home route', () => {
  it('published page wins over the default', async () => {
    getPublishedPage.mockResolvedValue(published);
    await renderPage();
    expect(screen.getByText('Published promo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop by category' })).not.toBeInTheDocument();
    expect(getPublishedPage).toHaveBeenCalledWith('mau-reseller-north', '/home');
  });

  it('no page renders the default layout', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Genuine parts from Küstenwerk Autoteile, ready near you.');
    expect(screen.getByRole('heading', { level: 2, name: 'Shop by category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Popular at Küstenwerk Autoteile' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(await screen.findByRole('heading', { name: 'Find parts for your vehicle' })).toBeInTheDocument();
  });

  it('contentools error falls back to the default', async () => {
    getPublishedPage.mockRejectedValue(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderPage();
    expect(screen.getByRole('heading', { level: 2, name: 'Shop by category' })).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });

  it('one h1 in either mode', async () => {
    await renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    document.body.innerHTML = '';
    getPublishedPage.mockResolvedValue(publishedWithHero);
    await renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    document.body.innerHTML = '';
    getPublishedPage.mockResolvedValue(published); // no hero in the document: a hidden heading keeps the page labelled
    await renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Küstenwerk Autoteile');
  });

  it('an unknown store is a 404', async () => {
    getHomeData.mockResolvedValue(null);
    await expect(StoreHome({ params })).rejects.toBeInstanceOf(NotFound);
  });

  it('an unsupported locale is a 404', async () => {
    await expect(StoreHome({ params: Promise.resolve({ locale: 'fr-FR', store: 'mau-reseller-north' }) })).rejects.toBeInstanceOf(NotFound);
  });
});

describe('Home metadata', () => {
  it('title names the reseller without repeating it through the layout template; description names the city', async () => {
    const meta = await generateMetadata({ params });
    expect(meta.title).toEqual({ absolute: 'Küstenwerk Autoteile | OEM car parts, fit guaranteed' });
    expect(meta.description).toBe('Genuine OEM parts for your vehicle from Küstenwerk Autoteile. Pick up in Hamburg or have it shipped.');
  });

  it('a store without a branch has a description without a city', async () => {
    getHomeData.mockResolvedValue(homeData({ branch: null }));
    expect((await generateMetadata({ params })).description).toBe('Genuine OEM parts for your vehicle from Küstenwerk Autoteile, shipped to your door.');
  });

  it('unknown store gives empty metadata', async () => {
    getHomeData.mockResolvedValue(null);
    expect(await generateMetadata({ params })).toEqual({});
  });
});
