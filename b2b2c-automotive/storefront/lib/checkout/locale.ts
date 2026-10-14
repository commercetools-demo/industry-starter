// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The hosted Checkout knows `de` and `en-US` but NOT `de-DE` (an unknown code silently falls back to English), so the route locale is mapped.
import type { AppLocale } from '@/i18n/config';

const CHECKOUT_LOCALES: Record<AppLocale, string> = { 'de-DE': 'de', 'en-US': 'en-US' };

export const checkoutLocale = (locale: AppLocale): string => CHECKOUT_LOCALES[locale];
