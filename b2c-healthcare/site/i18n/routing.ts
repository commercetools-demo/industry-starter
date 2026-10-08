import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/lib/utils';

// Routing locales derive from COUNTRY_CONFIG (lib/utils.ts); nothing is listed here by hand.
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: { name: LOCALE_COOKIE },
});

// Locale-aware navigation: use these instead of next/link and next/navigation in locale UI.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
