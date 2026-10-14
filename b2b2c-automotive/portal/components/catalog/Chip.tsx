/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';
import type { StateTone } from '@/lib/catalog/assortment-state';

const TONES: Record<StateTone, string> = {
  success: 'bg-bg-success-subdued text-text',
  info: 'bg-bg-info-subdued text-text',
  neutral: 'bg-bg-surface-subdued text-text-subdued',
  warning: 'bg-bg-warning-subdued text-text',
  critical: 'bg-bg-critical-subdued text-text',
};

const DOT: Record<StateTone, string> = {
  success: 'bg-text-success',
  info: 'bg-text-info',
  neutral: 'bg-text-subdued',
  warning: 'bg-text-warning',
  critical: 'bg-text-critical',
};

/** Status chip: a tinted background and a dot in the tone colour (the text keeps full contrast). */
export function Chip({ tone, children }: { tone: StateTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-150 whitespace-nowrap rounded-100 px-200 py-050 text-caption-1 font-semibold ${TONES[tone]}`}>
      <span aria-hidden="true" className={`size-150 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
