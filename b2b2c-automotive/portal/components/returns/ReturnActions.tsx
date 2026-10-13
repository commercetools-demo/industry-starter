'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { buttonDanger, buttonSecondary, buttonSmall } from '@/components/portal/kit';
import { canTransition, type ReturnStatus } from '@/lib/contracts/return-item';
import type { RefundState } from '@/lib/v-types';

type Move = 'in-transit' | 'received' | 'inspected' | 'refunded' | 'rejected';
const MOVES: Move[] = ['in-transit', 'received', 'inspected', 'refunded', 'rejected'];

/**
 * The actions of a return, one button per move of the lifecycle. A move the lifecycle (`canTransition`) or a waiting refund refuses is
 * disabled with the reason as text, linked with `aria-describedby`. The server enforces the same rules.
 */
export function ReturnActions({
  status,
  refundState = 'none',
  busy = false,
  onMove,
  onRefund,
  onReject,
}: {
  status: ReturnStatus;
  refundState?: RefundState;
  busy?: boolean;
  onMove: (to: 'in-transit' | 'received' | 'inspected') => void;
  onRefund: () => void;
  onReject: () => void;
}) {
  const t = useTranslations('returns');
  const base = useId();
  const closed = status === 'refunded' || status === 'rejected';
  const waiting = status === 'inspected' && refundState === 'pending';

  const reasonFor = (move: Move): string | null => {
    if (closed) return t('disabled.closed');
    if ((move === 'refunded' || move === 'rejected') && waiting) return t('disabled.refundPending');
    if (!canTransition(status, move)) return t('disabled.notFrom', { status: t(`status.${status}`) });
    return null;
  };

  const label = (move: Move): string => {
    if (move === 'refunded') return refundState === 'failed' ? t('actions.retryRefund') : t('actions.refund');
    return t(`actions.${move}`);
  };

  const click = (move: Move) => {
    if (move === 'refunded') onRefund();
    else if (move === 'rejected') onReject();
    else onMove(move);
  };

  return (
    <ul className="flex flex-col gap-250" aria-label={t('actions.label')}>
      {MOVES.map((move) => {
        const reason = reasonFor(move);
        const id = `${base}-${move}`;
        return (
          <li key={move} className="flex flex-col items-start gap-100">
            <button
              type="button"
              className={move === 'rejected' ? buttonDanger : move === 'refunded' ? buttonSecondary : buttonSmall}
              disabled={busy || reason !== null}
              aria-describedby={reason ? id : undefined}
              onClick={() => click(move)}
            >
              {label(move)}
            </button>
            {reason ? (
              <span id={id} className="text-caption-1 font-medium text-text-subdued">
                {reason}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
