// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIGURES, product, STORE, TREE } from '@/components/home/home-fixtures';
import enUS from '@/messages/en-US.json';
import enCA from '@/messages/en-CA.json';

const SECRET = 'a'.repeat(40);
// The website pages are tested as the website, whatever APP_MODE the run was started with (workstream R).
vi.stubEnv('APP_MODE', 'website');
const m = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  cookiesRead: vi.fn(),
  getHomeStore: vi.fn(),
  getFeaturedProduct: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => {
    m.cookiesRead();
    return { get: (name: string) => (name === 'malva-session' && m.cookie ? { name, value: m.cookie } : undefined) };
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const catalogue = (locale === 'en-CA' ? enCA : enUS) as unknown as Record<string, unknown>;
    const node = namespace.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], catalogue) as Record<string, string>;
    return (key: string) => node[key] ?? key;
  },
}));
vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/components/home/OpenStoreButton', () => ({ default: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button> }));
vi.mock('@/components/home/HomeSections', () => ({
  BestsellersSection: () => <i data-slot="bestsellers" />,
  NewArrivalsSection: () => <i data-slot="new" />,
  SubscribeSection: () => <i data-slot="subscribe" />,
}));
vi.mock('@/lib/ct/promise', () => ({ getPromiseFigures: async () => FIGURES }));
vi.mock('@/lib/home-data', () => ({
  getHomeTree: async () => TREE,
  getHomeStore: m.getHomeStore,
  getFeaturedProduct: m.getFeaturedProduct,
}));

import HomePage, { generateMetadata } from '@/app/[locale]/page';

async function render(locale = 'en-US'): Promise<string> {
  const ui = await HomePage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : enUS}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const token = (claims: Record<string, string>, exp: string | number) =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(SECRET));

beforeEach(() => {
  vi.clearAllMocks();
  m.cookie = undefined;
  m.getHomeStore.mockImplementation(async (ctx: { collectionStoreKey?: string }) => (ctx.collectionStoreKey ? STORE : null));
  m.getFeaturedProduct.mockResolvedValue(product());
});

describe('home page', () => {
  it('Anonymous visitor: page renders shared merchandising and no account slot', async () => {
    const html = await render();
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    for (const slot of ['bestsellers', 'new', 'subscribe']) expect(html).toContain(`data-slot="${slot}"`);
    expect(html).toContain('Collect in store, ready in minutes.');
    expect(html).not.toMatch(/Sign in|Welcome|Cart|Account/i);
    expect(html).not.toContain('<main');
  });

  it('a valid session with a store names the store in the banner', async () => {
    m.cookie = await token({ collectionStoreKey: STORE.key }, '1h');
    expect(await render()).toContain('Ready in 23 minutes at Malva Brooklyn.');
  });

  it('Expired session: page renders as anonymous with no name and no cart count', async () => {
    m.cookie = await token({ collectionStoreKey: STORE.key, customerFirstName: 'Maya', customerEmail: 'maya@example.com', cartId: 'c1' }, Math.floor(Date.now() / 1000) - 3600);
    const html = await render();
    expect(m.getHomeStore).toHaveBeenCalledWith(expect.not.objectContaining({ collectionStoreKey: expect.anything() }));
    expect(html).not.toContain('Maya');
    expect(html).not.toContain('maya@example.com');
    expect(html).toContain('Collect in store, ready in minutes.');
  });

  it('tampered cookie renders as anonymous', async () => {
    const valid = await token({ collectionStoreKey: STORE.key, customerFirstName: 'Maya' }, '1h');
    m.cookie = `${valid.slice(0, -4)}AAAA`;
    const html = await render();
    expect(html).not.toContain('Maya');
    expect(html).toContain('Collect in store, ready in minutes.');
  });

  it('Canada has no collection banner and no store button', async () => {
    const html = await render('en-CA');
    expect(html).not.toContain('Collect in store');
    expect(html).not.toContain('Find your store');
  });

  it('metadata has canonical and three alternates', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-CA' }) });
    expect(meta.alternates?.canonical).toBe('/en-CA');
    expect(meta.alternates?.languages).toEqual({ 'en-US': '/en-US', 'en-CA': '/en-CA', 'x-default': '/en-US' });
    expect(meta.title).toBe('Malva Coffee: pods, coffee and machines');
    expect(String(meta.description).length).toBeLessThanOrEqual(155);
  });

  it('json-ld is valid json with a SearchAction', async () => {
    const html = await render();
    const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const data = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')) as { '@graph': Array<Record<string, unknown>> };
    const site = data['@graph'].find((n) => n['@type'] === 'WebSite') as { potentialAction: { '@type': string; target: string } };
    expect(site.potentialAction['@type']).toBe('SearchAction');
    expect(site.potentialAction.target).toContain('/en-US/search?q={search_term_string}');
  });

  it('page does not set cache headers that allow sharing across sessions', async () => {
    await render();
    expect(m.cookiesRead).toHaveBeenCalled();
    const source = readFileSync(join(process.cwd(), 'app/[locale]/page.tsx'), 'utf8');
    expect(source).not.toMatch(/force-static|revalidate|Cache-Control|unstable_cache|use cache/);
  });
});
