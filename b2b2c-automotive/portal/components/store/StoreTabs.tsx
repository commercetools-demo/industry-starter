'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

/** The four tabs of Store & channels. Each is a route (deep-linkable); the Theme tab owns every path below `/store/theme`. */
export const STORE_TABS = [
  { id: 'settings', href: '/store/settings' },
  { id: 'channels', href: '/store/channels' },
  { id: 'share', href: '/store/share' },
  { id: 'theme', href: '/store/theme' },
] as const;

export type StoreTabId = (typeof STORE_TABS)[number]['id'];

export function activeStoreTab(pathname: string): StoreTabId {
  const hit = STORE_TABS.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return hit?.id ?? 'settings';
}

export function StoreTabs() {
  const t = useTranslations('store.tabs');
  const current = activeStoreTab(usePathname());
  return (
    <nav aria-label={t('label')} className="overflow-x-auto">
      <ul className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
        {STORE_TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={current === tab.id ? 'page' : undefined}
              className={`inline-flex h-1000 items-center whitespace-nowrap rounded-200 px-400 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${
                current === tab.id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'
              }`}
            >
              {t(tab.id)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
