'use client';

import { useTranslations } from 'next-intl';
import { Chip, type ChipTone } from '@/components/portal/Chip';
import type { ReturnStatus } from '@/lib/contracts/return-item';
import type { RefundState } from '@/lib/v-types';

/** Requested warning, In transit, Received and Inspected info, Refunded success, Rejected critical (spec "Status tones"). */
export const STATUS_TONE: Record<ReturnStatus, ChipTone> = {
  requested: 'warning',
  'in-transit': 'info',
  received: 'info',
  inspected: 'info',
  refunded: 'success',
  rejected: 'critical',
};

/** Status chip of a return, always with its text; a pending or failed refund adds its own chip next to it. */
export function StatusChip({ status, refundState = 'none' }: { status: ReturnStatus; refundState?: RefundState }) {
  const t = useTranslations('returns');
  return (
    <span className="inline-flex flex-wrap items-center gap-150">
      <span data-tone={STATUS_TONE[status]}>
        <Chip tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Chip>
      </span>
      {refundState === 'pending' ? (
        <span data-tone="warning">
          <Chip tone="warning">{t('refund.pending')}</Chip>
        </span>
      ) : null}
      {refundState === 'failed' ? (
        <span data-tone="critical">
          <Chip tone="critical">{t('refund.failed')}</Chip>
        </span>
      ) : null}
    </span>
  );
}
