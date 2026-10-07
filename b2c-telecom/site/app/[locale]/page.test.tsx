import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { HOME_TREE, OFFERS_BY_CATEGORY } from '@/components/home/__fixtures__/home';
import { CATALOG_TTL } from '@/lib/config/cache';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ locale: 'en-US' as 'en-US' | 'de-DE' }));

// Any read of the session or the cart through next/headers would throw: the page must not need them.
vi.mock('next/headers', () => ({
  cookies: () => {
    throw new Error('cookies() must not be read by the home page');
  },
  headers: () => {
    throw new Error('headers() must not be read by the home page');
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (options?: string | { namespace?: string }) =>
    createTranslator({ locale: state.locale, messages: state.locale === 'en-US' ? enMessages : deMessages, namespace: (typeof options === 'string' ? options : options?.namespace) as never }),
}));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => HOME_TREE }));
vi.mock('@/lib/ct/catalog', () => ({ getOffersInCategory: async (key: string) => OFFERS_BY_CATEGORY[key] ?? [] }));

import HomePage, { generateMetadata, generateStaticParams, revalidate } from './page';

const render_ = async () => renderWithProviders(await HomePage({ params: Promise.resolve({ locale: 'en-US' }) }));

describe('[locale] home page', () => {
  beforeEach(() => {
    state.locale = 'en-US';
  });

  it('Anonymous visitor: shared merchandising renders in full and no account-dependent slot exists', async () => {
    await render_();
    expect(screen.getByRole('heading', { level: 1, name: 'Fast fiber cable. Zero surprises.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plans from $25 a line' })).toBeInTheDocument();
    const categories = screen.getByRole('region', { name: 'Shop by category' });
    expect(within(categories).getAllByRole('listitem')).toHaveLength(4);
    const addons = screen.getByRole('region', { name: 'Popular add-ons' });
    expect(within(addons).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText(/Log in|Hi,|My bundle/)).not.toBeInTheDocument();
  });

  it('Expired session: page output is identical and never reads the session or the cart', async () => {
    const first = (await render_()).container.innerHTML;
    document.cookie = 'malva-session=garbage; path=/';
    document.body.innerHTML = '';
    const second = (await render_()).container.innerHTML;
    expect(second).toBe(first);
  });

  it('is revalidated on the catalog TTL', () => {
    expect(revalidate).toBe(CATALOG_TTL);
  });

  it('generateStaticParams returns both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en-US' }, { locale: 'de-DE' }]);
  });

  it('metadata carries the title, the canonical URL and both language alternates', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) });
    expect(metadata.title).toBe('Malva Telecom: phone, wireless and cable internet');
    expect(metadata.alternates).toEqual({ canonical: '/en-US', languages: { 'en-US': '/en-US', 'de-DE': '/de-DE' } });
    expect(metadata.openGraph?.images).toEqual(['https://images.pexels.com/photos/1/hero.jpeg']);
  });

  it('renders German copy for de-DE', async () => {
    state.locale = 'de-DE';
    renderWithProviders(await HomePage({ params: Promise.resolve({ locale: 'de-DE' }) }), { locale: 'de-DE' });
    expect(screen.getByText('Neukunden')).toBeInTheDocument();
    expect(screen.getByText('Beliebte Zusatzoptionen')).toBeInTheDocument();
  });
});
