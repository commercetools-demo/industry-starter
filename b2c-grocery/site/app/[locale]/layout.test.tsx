import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import LocaleLayout, { generateStaticParams } from './layout';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: () => notFound() }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getMessages: vi.fn(async () => (globalThis as { __msgs?: unknown }).__msgs),
}));

const render = async (locale: string) =>
  LocaleLayout({ children: <span>child</span>, params: Promise.resolve({ locale }) });

describe('LocaleLayout', () => {
  it('provides the German catalog for de-DE', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = de;
    const el = await render('de-DE');
    expect(el.type).toBe(NextIntlClientProvider);
    expect(el.props.locale).toBe('de-DE');
    expect(el.props.messages.nav.new).toBe('Neu');
    expect(renderToStaticMarkup(<>{el.props.children}</>)).toContain('child');
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
