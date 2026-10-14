/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';

/** Page title 32/40, subtitle and at most one primary action (design: page header). */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-1200 items-center justify-between gap-400">
      <div className="min-w-0">
        <h1 className="text-h4 font-semibold text-text">{title}</h1>
        {subtitle ? <p className="text-body-2 font-medium text-text-subdued">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}
