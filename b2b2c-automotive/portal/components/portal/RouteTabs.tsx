/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { Link, usePathname } from '@/i18n/routing';

export interface RouteTab {
  id: string;
  href: string;
  label: string;
}

/** A tab strip whose tabs are routes (deep-linkable). The active tab is the one whose href is the path or its parent. */
export function RouteTabs({ tabs, ariaLabel }: { tabs: RouteTab[]; ariaLabel: string }) {
  const pathname = usePathname();
  const current = tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))?.id ?? tabs[0]?.id;
  return (
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={current === tab.id ? 'page' : undefined}
              className={`inline-flex h-1000 items-center whitespace-nowrap rounded-200 px-400 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${
                current === tab.id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
