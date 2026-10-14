/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ButtonHTMLAttributes } from 'react';
import type { PortalAction } from '@/lib/authz/permissions';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * A control whose action the role cannot perform is disabled (not hidden) with the reason shown as text and title
 * ("Insufficient permissions to perform this task"). The server re-checks every action regardless of this button.
 */
export function PermissionButton({ action, children, className = '', ...rest }: { action: PortalAction } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslations('permissions');
  const { can } = usePermissions();
  const allowed = can(action);
  return (
    <span className="inline-flex flex-col items-start gap-100">
      <button
        type="button"
        {...rest}
        disabled={!allowed || rest.disabled}
        title={allowed ? rest.title : t('insufficient')}
        aria-describedby={allowed ? undefined : `perm-${action}`}
        className={`h-1100 rounded-300 border border-border-on bg-bg-brand px-450 text-body-2 font-bold text-text-on shadow-button hover:bg-bg-brand-hover disabled:cursor-not-allowed disabled:bg-bg-brand-disabled ${className}`}
      >
        {children}
      </button>
      {allowed ? null : (
        <span id={`perm-${action}`} className="text-caption-1 text-text-subdued">
          {t('insufficient')}
        </span>
      )}
    </span>
  );
}
