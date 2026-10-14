/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import type { LogicalRole } from '@/lib/authz/permissions';
import type { Viewer } from '@/lib/portal/types';

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({ name, size }: { name: string; size: 'sm' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-full bg-chart-3 text-caption-1 font-bold text-gray-16 ${size === 'lg' ? 'size-1200' : 'size-1000'}`}
    >
      {initialsOf(name)}
    </span>
  );
}

export function useRoleLabel() {
  const t = useTranslations('shell');
  return (roles: LogicalRole[]) => (roles.includes('admin') ? t('role.admin') : roles.includes('buyer') ? t('role.buyer') : '');
}

/** The user at the foot of the rail: avatar, name and "role · business unit". Collapsed rail shows the avatar only. */
export function UserCard({ viewer, collapsible }: { viewer: Viewer; collapsible: boolean }) {
  const roleLabel = useRoleLabel();
  return (
    <div className={`flex items-center gap-300 rounded-300 bg-bg-surface p-300 ${collapsible ? 'max-lg:justify-center max-lg:p-0' : ''}`}>
      <Avatar name={viewer.name} size="lg" />
      <div className={`min-w-0 ${collapsible ? 'max-lg:sr-only' : ''}`}>
        <p className="truncate text-body-1 font-bold text-text">{viewer.name}</p>
        <p className="truncate text-caption-1 font-medium text-text-subdued">
          {roleLabel(viewer.roles)} · {viewer.businessUnitName}
        </p>
      </div>
    </div>
  );
}
