import { render, screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const state = vi.hoisted(() => ({ messages: {} as Record<string, unknown> }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  getMessages: async () => state.messages,
  setRequestLocale: vi.fn(),
}));

import LocaleLayout, { generateStaticParams } from './layout';

function Probe() {
  const t = useTranslations();
  return <p>{t('home.placeholder')}</p>;
}

describe('[locale] layout', () => {
  it('with de-DE provides the German home.placeholder', async () => {
    state.messages = deMessages;
    render(await LocaleLayout({ children: <Probe />, params: Promise.resolve({ locale: 'de-DE' }) }));
    expect(screen.getByText('Malva Telecom Shop')).toBeInTheDocument();
  });

  it('with en-US provides the English home.placeholder', async () => {
    state.messages = enMessages;
    render(await LocaleLayout({ children: <Probe />, params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.getByText('Malva Telecom storefront')).toBeInTheDocument();
  });

  it('an unsupported locale calls notFound', async () => {
    await expect(LocaleLayout({ children: <Probe />, params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NOT_FOUND');
  });

  it('generateStaticParams returns both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en-US' }, { locale: 'de-DE' }]);
  });
});
