/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons/Icon';
import { Link, usePathname } from '@/i18n/routing';
import type { LogicalRole } from '@/lib/authz/permissions';
import { visibleNav, type NavItem } from '@/lib/portal/nav';

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

function NavLink({ item, collapsible, onNavigate }: { item: NavItem; collapsible: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const label = t(item.labelKey);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={label}
      onClick={onNavigate}
      className={`flex h-1200 w-full items-center gap-400 rounded-300 px-300 text-body-1 font-semibold ${collapsible ? 'max-lg:justify-center max-lg:px-0' : ''} ${
        active ? 'bg-bg-surface text-text' : 'text-text-subdued hover:bg-bg-surface-hover'
      }`}
    >
      <Icon name={item.icon} />
      <span className={collapsible ? 'flex-1 max-lg:sr-only' : 'flex-1'}>{label}</span>
    </Link>
  );
}

/**
 * The navigation a role set may see: Dashboard, then the groups of lib/portal/nav.ts. `collapsible` hides the labels
 * (screen-reader only) in the 84 px icon rail between 700 and 1024 px; the drawer uses the expanded form.
 */
export function NavList({ roles, collapsible, onNavigate }: { roles: LogicalRole[]; collapsible: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const { top, groups } = visibleNav(roles);
  return (
    <nav aria-label={t('nav.label')} className="flex flex-col gap-200">
      <NavLink item={top} collapsible={collapsible} onNavigate={onNavigate} />
      {groups.map((group) => (
        <div key={group.id} role="group" aria-labelledby={`nav-group-${group.id}`} className="flex flex-col gap-200">
          <p
            id={`nav-group-${group.id}`}
            className={`px-300 pt-300 text-caption-2 font-semibold uppercase tracking-wider text-text-subdued ${collapsible ? 'max-lg:sr-only' : ''}`}
          >
            {t(group.labelKey)}
          </p>
          {group.items.map((item) => (
            <NavLink key={item.id} item={item} collapsible={collapsible} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
