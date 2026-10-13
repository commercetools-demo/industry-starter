// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import { getShellContext } from '@/lib/ct/shell';

/**
 * `generateMetadata` of an account page (workstream Y, WCAG 2.4.2): the page's own title ("Orders") instead of the layout's "My account" on
 * every page. The store layout's template appends the store name. `title` keys live in `account.<namespace>`.
 */
export function accountPageTitle(namespace: 'orders' | 'order' | 'return' | 'returns' | 'garage' | 'addresses' | 'payment' | 'subscriptions' | 'profile', values?: (params: Record<string, string>) => Record<string, string>) {
  return async function generateMetadata({ params }: { params: Promise<Record<string, string>> }): Promise<Metadata> {
    const resolved = await params;
    if (!isAppLocale(resolved.locale)) return {};
    const t = await getTranslations({ locale: resolved.locale });
    // The key is built from the namespace argument (every `account.<namespace>.title` exists in both catalogues; the page tests cover them).
    const title = t(`account.${namespace}.title` as never, (values ? values(resolved) : undefined) as never);
    // The account layout sets its own title, which ends the store layout's template: the store name is added here.
    const ctx = await getShellContext(resolved.store, resolved.locale).catch(() => null);
    return { title: ctx ? { absolute: `${title} | ${ctx.settings.name}` } : title, robots: { index: false, follow: false } };
  };
}
