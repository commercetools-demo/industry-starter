import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { ToastProvider } from '@/components/ui/Toast';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { COUNTRY_CONFIG } from '@/lib/utils';
import LocaleLayout, { generateStaticParams } from './layout';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: () => notFound() }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getMessages: vi.fn(async () => (globalThis as { __msgs?: unknown }).__msgs),
  getTranslations: vi.fn(async () => (key: string) => `nav.${key}`),
}));
// Chrome pieces are tested on their own; here we only check the composition and order.
vi.mock('@/components/layout/AnnouncementBar', () => ({ AnnouncementBar: () => <div data-slot="announcement" /> }));
vi.mock('@/components/layout/Header', () => ({
  Header: ({ markets, bag, account }: { markets: unknown[]; bag: React.ReactNode; account: React.ReactNode }) => (
    <header data-slot="header" data-markets={markets.length}>
      {bag}
      {account}
    </header>
  ),
}));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer data-slot="footer" /> }));

const render = async (locale: string) =>
  LocaleLayout({ children: <span>child</span>, params: Promise.resolve({ locale }) });

describe('LocaleLayout', () => {
  it('provides the German catalog for de-DE', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = de;
    const el = await render('de-DE');
    expect(el.type).toBe(NextIntlClientProvider);
    expect(el.props.locale).toBe('de-DE');
    expect(el.props.messages.nav.new).toBe('Neu');
    expect(renderToStaticMarkup(el)).toContain('child');
  });

  it('wraps the chrome in the ToastProvider, directly inside the intl provider', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    expect(el.props.children.type).toBe(ToastProvider);
  });

  it('renders announcement, header, main (page-enter) and footer in that order', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    const html = renderToStaticMarkup(el);
    const order = ['data-slot="announcement"', 'data-slot="header"', '<main class="page-enter"><span>child</span></main>', 'data-slot="footer"'];
    const positions = order.map((s) => html.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('passes every configured market to the header and fills the bag and account slots', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    const html = renderToStaticMarkup(el);
    expect(html).toContain(`data-markets="${Object.keys(COUNTRY_CONFIG).length}"`);
    expect(html).toContain('nav.bag');
    expect(html).toContain('aria-label="nav.account"');
  });

  it('Unsupported locale: invalid locale calls notFound', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    await expect(render('xx-YY')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('generates static params for both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en-US' }, { locale: 'de-DE' }]);
  });
});
