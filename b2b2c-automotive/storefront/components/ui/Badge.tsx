// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { HTMLAttributes } from 'react';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-600',
  danger: 'bg-danger-50 text-danger-600',
  warning: 'bg-warning-50 text-text-body',
  info: 'bg-info-50 text-info-600',
  neutral: 'bg-surface-subtle text-text-muted',
};

export function Badge({ tone = 'neutral', className = '', ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={`inline-flex items-center rounded-xs px-2 py-1 font-ui text-xs font-bold ${TONES[tone]} ${className}`.trim()} {...rest} />;
}
