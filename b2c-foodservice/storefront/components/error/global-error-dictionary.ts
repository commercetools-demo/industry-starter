/**
 * global-error replaces the root layout, so it cannot use the message catalogues or NextIntlClientProvider.
 * This small inline dictionary is the one allowed exception to "strings come from the catalogues"; a test checks both locales.
 * The wording equals `error.server.*` and `error.retry` / `error.home` in the catalogues.
 */
export const GLOBAL_ERROR_DICTIONARY = {
  'en-US': {
    title: "Something went wrong on our side.",
    text: 'Your bag and your account are safe. Please try again.',
    retry: 'Try again',
    home: 'Back to home',
    reference: 'Reference',
  },
  'en-CA': {
    title: "Something went wrong on our side.",
    text: 'Your bag and your account are safe. Please try again.',
    retry: 'Try again',
    home: 'Back to home',
    reference: 'Reference',
  },
} as const;

export type GlobalErrorLocale = keyof typeof GLOBAL_ERROR_DICTIONARY;

/** The locale from the first path segment; the default locale when it is not one of ours. */
export function localeFromPath(pathname: string): GlobalErrorLocale {
  const first = pathname.split('/')[1] ?? '';
  return first in GLOBAL_ERROR_DICTIONARY ? (first as GlobalErrorLocale) : 'en-US';
}
