import { createElement, type ComponentProps } from 'react';
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { COUNTRY_CONFIG } from '@/lib/utils';

export const routing = defineRouting({
  locales: Object.keys(COUNTRY_CONFIG) as [string, ...string[]],
  defaultLocale: 'en-US',
  localePrefix: 'always',
});

const navigation = createNavigation(routing);

export const { redirect, permanentRedirect, usePathname, useRouter, getPathname } = navigation;

/**
 * The locale-aware link, with prefetching off unless a link asks for it. Every page here is rendered for the visitor (session,
 * market, stock), so a prefetch only costs a request and a server render; the home page made 14 of them (found by Q, perf.md).
 */
export function Link(props: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, { prefetch: false, ...props });
}
