/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { CHIP_TONE, type ChipTone, type OrderChip } from '@/lib/mappers/order-status';

// Literal class names so Tailwind sees them: admin-kit `*-subdued` fill with the primary text colour, badge 24 px. The kit's dark
// `*-subdued` fills are translucent black, so a dot in the solid status colour keeps the tone readable in both themes.
const TONE_CLASS: Record<ChipTone, { chip: string; dot: string }> = {
  success: { chip: 'bg-bg-success-subdued', dot: 'bg-bg-success' },
  info: { chip: 'bg-bg-info-subdued', dot: 'bg-bg-info' },
  warning: { chip: 'bg-bg-warning-subdued', dot: 'bg-bg-warning' },
  critical: { chip: 'bg-bg-critical-subdued', dot: 'bg-bg-critical' },
};

export function StatusChip({ chip, label }: { chip: OrderChip; label: string }) {
  const tone = CHIP_TONE[chip];
  return (
    <span data-tone={tone} className={`inline-flex h-600 items-center gap-100 whitespace-nowrap rounded-100 px-200 text-caption-1 font-semibold text-text ${TONE_CLASS[tone].chip}`}>
      <span aria-hidden="true" className={`size-150 flex-none rounded-full ${TONE_CLASS[tone].dot}`} />
      {label}
    </span>
  );
}
