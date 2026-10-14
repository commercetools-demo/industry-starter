/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/utils';

export const routing = defineRouting({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE, localePrefix: 'always' });

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
