/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { LogicalRole } from '@/lib/authz/permissions';
import type { Viewer } from '@/lib/portal/types';
import { NavList } from './NavList';
import { UserCard } from './UserCard';

/**
 * Floating rail on the page canvas: 316 px wide with a 24 px outer pad (340 px column), radius 32, sticky; an 84 px icon rail
 * under 1024 px; absent under 700 px, where the drawer takes over.
 */
export function SidebarRail({ roles, viewer }: { roles: LogicalRole[]; viewer: Viewer }) {
  return (
    <aside data-testid="sidebar" className="w-sidebar flex-none p-600 max-lg:w-sidebar-collapsed max-lg:p-300 narrow:hidden">
      <div className="sticky top-600 flex max-h-[calc(100vh-var(--topbar-height)-var(--space-1200))] min-h-[calc(100vh-var(--topbar-height)-var(--space-1200))] flex-col justify-between gap-600 overflow-y-auto rounded-sidebar bg-bg-surface-subdued px-400 py-600 max-lg:px-300">
        <NavList roles={roles} collapsible />
        <div className="flex flex-col gap-400">
          <hr className="border-border-subdued" />
          <UserCard viewer={viewer} collapsible />
        </div>
      </div>
    </aside>
  );
}
