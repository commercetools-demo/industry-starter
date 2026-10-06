'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { useProposals } from '@/hooks/useProposals';
import { keyOrder } from '@/lib/cache-keys';
import { ApiError } from '@/lib/fetcher';
import type { Order, Proposal } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

type Notice = 'stale' | 'notEditable' | 'failed';

/** "+$3.00", "-$0.47" or "No price difference". */
function differenceText(proposal: Proposal, locale: string, noDifference: string): string {
  const { centAmount, currencyCode } = proposal.priceDifference;
  if (centAmount === 0) return noDifference;
  return `${centAmount > 0 ? '+' : '-'}${formatMoney(Math.abs(centAmount), currencyCode, locale)}`;
}

function ProposalNotice({
  proposal,
  busy,
  onAccept,
  onDecline,
}: {
  proposal: Proposal;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations('account.order.substitution');
  const locale = useLocale();
  return (
    <Card elev="sm" className="gap-(--space-2) bg-accent-100 p-[17.6px]" data-testid="proposal" role="group" aria-label={t('groupLabel', { name: proposal.originalName })}>
      <p className="m-0 text-[15px]">
        {t('notice', {
          original: proposal.originalName,
          substitute: proposal.substituteName,
          difference: differenceText(proposal, locale, t('noDifference')),
        })}
      </p>
      {proposal.newTotal ? <p className="m-0 text-[15px]">{t('newTotal', { total: formatMoney(proposal.newTotal.centAmount, proposal.newTotal.currencyCode, locale) })}</p> : null}
      {proposal.note ? <p className="m-0 text-[13px] text-text/60">{proposal.note}</p> : null}
      {proposal.editable ? (
        <div className="mt-(--space-2) flex flex-wrap gap-(--space-3)">
          <Button disabled={busy} onClick={onAccept} aria-label={t('acceptLabel', { name: proposal.originalName })}>
            {t('accept')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onDecline} aria-label={t('declineLabel', { name: proposal.originalName })}>
            {t('decline')}
          </Button>
        </div>
      ) : (
        <p className="m-0 flex flex-wrap items-center gap-(--space-3) text-[15px]">
          <span>{t('readOnly')}</span>
          <Button href="/contact" variant="secondary">
            {t('contact')}
          </Button>
        </p>
      )}
    </Card>
  );
}

/**
 * Pending substitution proposals of an order (Order Edits created in Merchant Center or by API), each with Accept and Decline.
 * Accept applies the edit server-side and refetches the order; Decline records a removal request. Nothing shows without proposals.
 */
export function OrderSubstitutions({ order }: { order: Order }) {
  const t = useTranslations('account.order.substitution');
  const { mutate: mutateGlobal } = useSWRConfig();
  const { proposals, accept, decline, mutate } = useProposals(order.id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const run = async (action: (editId: string) => Promise<void>, editId: string, refreshOrder: boolean) => {
    setBusyId(editId);
    setNotice(null);
    try {
      await action(editId);
      if (refreshOrder) await mutateGlobal(keyOrder(order.id));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        setNotice(e.status === 409 ? 'stale' : 'notEditable');
        // Show the current state: the order may have changed, so refetch both.
        await Promise.all([mutate(), mutateGlobal(keyOrder(order.id))]);
      } else {
        setNotice('failed');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (proposals.length === 0 && !notice) return null;
  return (
    <section className="flex flex-col gap-(--space-3)" aria-label={t('title')} data-testid="order-substitutions">
      {notice ? (
        <p role="alert" className="m-0 text-[15px] text-accent-700">
          {t(notice)}
        </p>
      ) : null}
      {proposals.map((proposal) => (
        <ProposalNotice
          key={proposal.editId}
          proposal={proposal}
          busy={busyId !== null}
          onAccept={() => void run(accept, proposal.editId, true)}
          onDecline={() => void run(decline, proposal.editId, false)}
        />
      ))}
    </section>
  );
}

/** "Removal requested" tag for an order line whose substitution proposal the customer declined. */
export function LineRemovalTag({ orderId, lineId }: { orderId: string; lineId: string }) {
  const t = useTranslations('account.order.substitution');
  const { removalRequested } = useProposals(orderId);
  return removalRequested.includes(lineId) ? <Tag tone="accent-2">{t('removalRequested')}</Tag> : null;
}
