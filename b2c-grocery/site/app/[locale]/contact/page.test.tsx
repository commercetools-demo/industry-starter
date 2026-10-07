import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';
import ContactPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) });

describe('Contact page', () => {
  it('English: title, intro and the form', async () => {
    expect(await generateMetadata(props('en-US'))).toMatchObject({ title: 'Contact us' });
    renderWithProviders(await ContactPage(props('en-US')));
    expect(screen.getByRole('heading', { level: 1, name: 'Contact us' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
  });

  it('German: German title and form', async () => {
    expect(await generateMetadata(props('de-DE'))).toMatchObject({ title: 'Kontakt' });
    renderWithProviders(await ContactPage(props('de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeInTheDocument();
  });
});
