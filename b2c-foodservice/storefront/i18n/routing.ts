import { defineRouting } from 'next-intl/routing';
import { permanentRedirect as nextPermanentRedirect, redirect as nextRedirect } from 'next/navigation';
import { DEFAULT_BRAND, type BrandSlug } from '@/lib/brands';
import { withBrandAndLocale } from '@/i18n/paths';
import { COUNTRY_CONFIG } from '@/lib/utils';

export const routing = defineRouting({
  locales: Object.keys(COUNTRY_CONFIG) as [string, ...string[]],
  defaultLocale: 'en-US',
  localePrefix: 'always',
});

// Client side: `Link`, `useRouter`, `usePathname` and `useBrand` live in a 'use client' module, re-exported here so every call site keeps
// importing navigation from '@/i18n/routing'.
export { Link, useBrand, usePathname, useRouter } from '@/i18n/navigation';

interface Target { href: string; locale: string; brand?: BrandSlug }

/** The public path of a locale-free href: `/{brand}/{locale}{href}`. Server components pass the brand from their route params. */
export function getPathname({ href, locale, brand = DEFAULT_BRAND }: Target): string {
  return withBrandAndLocale(href, brand, locale);
}

/** Server redirect (307) to a brand and locale aware path. Throws, like Next's `redirect`. */
export function redirect(target: Target): never {
  return nextRedirect(getPathname(target));
}

/** Server redirect (308). Throws. */
export function permanentRedirect(target: Target): never {
  return nextPermanentRedirect(getPathname(target));
}
