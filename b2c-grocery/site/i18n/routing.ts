import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { COUNTRY_CONFIG, DEFAULT_LOCALE } from '@/lib/utils';

export const routing = defineRouting({
  locales: Object.keys(COUNTRY_CONFIG),
  defaultLocale: DEFAULT_LOCALE.locale,
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
