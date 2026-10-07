// `next-intl/server` for page tests: translators over the real message files; `setRequestLocale` remembers the locale for the
// string form of `getTranslations`. Use: vi.mock('next-intl/server', async () => (await import('@/test/fixtures/serverIntl')).serverIntlMock)
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const MESSAGES = { 'en-US': enMessages, 'de-DE': deMessages } as const;
type Locale = keyof typeof MESSAGES;

let current: Locale = 'en-US';

export const serverIntlMock = {
  setRequestLocale: (locale: string): void => {
    current = locale === 'de-DE' ? 'de-DE' : 'en-US';
  },
  getTranslations: async (arg: string | { locale: string; namespace: string }) => {
    const locale: Locale = typeof arg === 'string' ? current : arg.locale === 'de-DE' ? 'de-DE' : 'en-US';
    const namespace = typeof arg === 'string' ? arg : arg.namespace;
    return createTranslator({ locale, messages: MESSAGES[locale], namespace: namespace as never });
  },
};
