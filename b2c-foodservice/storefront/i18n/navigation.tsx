'use client';

// The brand-aware navigation layer (multibrand design D2). Public URLs are `/{brand}/{locale}/...`; call sites keep passing
// locale-free, brand-free hrefs (`/p/x`, `/cart`) exactly as with next-intl, and this layer adds `/{brand}/{locale}`. The brand
// is read from the route param, the locale from next-intl. Only this file may use `next/link` and the next/navigation hooks.
import NextLink from 'next/link';
import { useParams, usePathname as useNextPathname, useRouter as useNextRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createElement, useMemo, type ComponentProps } from 'react';
import { DEFAULT_BRAND, isBrandSlug, type BrandSlug } from '@/lib/brands';
import { withBrandAndLocale, stripBrandAndLocale } from '@/i18n/paths';

/** The brand of the current URL (the default brand outside a brand route, for example the global error page). */
export function useBrand(): BrandSlug {
  const params = useParams<{ brand?: string }>();
  return isBrandSlug(params?.brand) ? params.brand : DEFAULT_BRAND;
}

type NavOptions = { locale?: string; brand?: BrandSlug };

/** The pathname without brand and locale (`/` for a home page), like next-intl's `usePathname`. */
export function usePathname(): string {
  return stripBrandAndLocale(useNextPathname() ?? '/');
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { href: ComponentProps<typeof NextLink>['href']; locale?: string; brand?: BrandSlug };

/** The brand and locale aware link, with prefetching off unless a link asks for it (every page is rendered for the visitor). */
export function Link({ href, locale, brand, ...rest }: LinkProps) {
  const currentLocale = useLocale();
  const currentBrand = useBrand();
  const target = typeof href === 'string'
    ? withBrandAndLocale(href, brand ?? currentBrand, locale ?? currentLocale)
    : { ...href, pathname: href.pathname ? withBrandAndLocale(href.pathname, brand ?? currentBrand, locale ?? currentLocale) : href.pathname };
  return createElement(NextLink, { prefetch: false, ...rest, href: target });
}

/** `useRouter` with the same href rules as `Link`; `{ locale }` switches the market, `{ brand }` the brand. */
export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale();
  const brand = useBrand();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: NavOptions) => router.push(withBrandAndLocale(href, options?.brand ?? brand, options?.locale ?? locale)),
    replace: (href: string, options?: NavOptions) => router.replace(withBrandAndLocale(href, options?.brand ?? brand, options?.locale ?? locale)),
    prefetch: (href: string, options?: NavOptions) => router.prefetch(withBrandAndLocale(href, options?.brand ?? brand, options?.locale ?? locale)),
  }), [router, locale, brand]);
}
