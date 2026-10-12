// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE_KEY, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from './config';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE_KEY,
  localePrefix: 'always',
  // The proxy decides the bare-path redirect from the cookie only (no Accept-Language), see lib/locale-redirect.ts.
  localeDetection: false,
  localeCookie: { name: LOCALE_COOKIE, maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax', path: '/' },
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
