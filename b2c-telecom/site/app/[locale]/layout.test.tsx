import { render, screen } from '@testing-library/react';
import { createTranslator, useTranslations } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { useToast } from '@/components/ui/Toast';

const state = vi.hoisted(() => ({ messages: {} as Record<string, unknown>, locale: 'en-US' }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  getMessages: async () => state.messages,
  getTranslations: async (namespace: string) => createTranslator({ locale: state.locale, messages: state.messages, namespace: namespace as never }),
  setRequestLocale: vi.fn(),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => '/',
}));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));
vi.mock('./_shell/AccountSlot', () => ({ AccountSlot: () => <span>account slot</span> }));
vi.mock('./_shell/loadNavItems', () => ({
  loadNavItems: async () => [{ key: 'malva-cat-phone-plans', label: 'Phone plans', path: '/shop/phone-plans', matchSlugs: ['phone-plans'] }],
}));

import LocaleLayout, { generateStaticParams } from './layout';

function Probe() {
  const t = useTranslations();
  const { show } = useToast();
  return (
    <>
      <p>{t('home.placeholder')}</p>
      <button type="button" onClick={() => show({ message: 'hello' })}>
        toast
      </button>
    </>
  );
}

async function renderLayout(locale: 'en-US' | 'de-DE') {
  state.locale = locale;
  state.messages = locale === 'en-US' ? enMessages : deMessages;
  render(await LocaleLayout({ children: <Probe />, params: Promise.resolve({ locale }) }));
}

describe('[locale] layout', () => {
  it('with de-DE provides the German home.placeholder', async () => {
    await renderLayout('de-DE');
    expect(screen.getByText('Malva Telecom Shop')).toBeInTheDocument();
  });

  it('with en-US provides the English home.placeholder', async () => {
    await renderLayout('en-US');
    expect(screen.getByText('Malva Telecom storefront')).toBeInTheDocument();
  });

  it('an unsupported locale calls notFound', async () => {
    await expect(LocaleLayout({ children: <Probe />, params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NOT_FOUND');
  });

  it('generateStaticParams returns both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en-US' }, { locale: 'de-DE' }]);
  });

  it('renders the skip link, header, main and footer in that DOM order', async () => {
    await renderLayout('en-US');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const header = screen.getByRole('banner');
    const main = screen.getByRole('main');
    const footer = screen.getByRole('contentinfo');
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(skip, header)).toBe(true);
    expect(follows(header, main)).toBe(true);
    expect(follows(main, footer)).toBe(true);
    expect(skip).toHaveAttribute('href', '#main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('the header shows the nav item, the account slot and the bundle pill', async () => {
    await renderLayout('en-US');
    expect(screen.getAllByText('account slot').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'My bundle · 0' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Phone plans' }).length).toBeGreaterThan(0);
  });

  it('ToastProvider wraps the page so useToast works in children', async () => {
    await renderLayout('en-US');
    screen.getByRole('button', { name: 'toast' }).click();
    expect(await screen.findByText('hello')).toBeInTheDocument();
  });

  it('there is exactly one main landmark', async () => {
    await renderLayout('de-DE');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Zum Inhalt springen' })).toBeInTheDocument();
  });
});
