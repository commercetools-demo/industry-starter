/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

/** The six tabs of Catalog & pricing, in the design's order. Each is a route (deep-linkable); the editor of a discount belongs to its list's tab. */
export const CATALOG_TABS = [
  { id: 'assigned', href: '/catalog' },
  { id: 'prices', href: '/catalog/prices' },
  { id: 'productInfo', href: '/catalog/product-info' },
  { id: 'productDiscounts', href: '/catalog/product-discounts' },
  { id: 'cartDiscounts', href: '/catalog/cart-discounts' },
  { id: 'priority', href: '/catalog/priority' },
] as const;

export function activeTab(pathname: string): (typeof CATALOG_TABS)[number]['id'] {
  const editor = /^\/catalog\/discounts\/(product|cart)\//.exec(pathname);
  if (editor) return editor[1] === 'product' ? 'productDiscounts' : 'cartDiscounts';
  const hit = [...CATALOG_TABS].reverse().find((tab) => tab.href !== '/catalog' && (pathname === tab.href || pathname.startsWith(`${tab.href}/`)));
  return hit?.id ?? 'assigned';
}

export function CatalogTabs() {
  const t = useTranslations('catalog.tabs');
  const pathname = usePathname();
  const current = activeTab(pathname);
  return (
    <nav aria-label={t('label')} className="overflow-x-auto">
      <ul className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
        {CATALOG_TABS.map((tab) => (
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
