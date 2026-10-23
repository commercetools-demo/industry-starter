'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import LineImage from '@/components/cart/LineImage';
import { useIntervalLabel, useMoney } from '@/components/cart/use-cart-ui';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/context/toast';
import { useSubscriptionActions } from '@/hooks/useSubscriptions';
import { Link } from '@/i18n/routing';
import { contactHref } from '@/lib/routes';
import type { Subscription, SubscriptionAction } from '@/lib/types';
import CancelDialog from './CancelDialog';
import ChangeIntervalDialog from './ChangeIntervalDialog';
import { useDateLabel } from './format';
import StatusPill from './StatusPill';

const BTN = 'max-[519px]:min-h-11 max-[519px]:w-full';

/**
 * One subscription (a recurring order): thumbnail, name and variant, interval, next delivery, price, status and the actions
 * Skip next, Change interval, Pause or Resume, Cancel. Every change is one `PUT /api/recurring-orders/[id]`; the card renders
 * from the response (the subscription after the change), never from a guess.
 */
export default function SubscriptionCard({ subscription: s }: { subscription: Subscription }) {
  const t = useTranslations('subscription');
  const money = useMoney();
  const interval = useIntervalLabel();
  const date = useDateLabel();
  const toast = useToast();
  const act = useSubscriptionActions();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'interval' | 'cancel' | null>(null);

  const first = s.lines[0];
  const extra = s.lines.length - 1;
  const skipPending = s.pendingSkips > 0;
  const active = s.state === 'active';

  const run = async (action: SubscriptionAction, done: (after: Subscription) => string) => {
    setBusy(true);
    try {
      const after = await act(s.id, action);
      setDialog(null);
      toast.show(done(after));
    } catch {
      toast.show(t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const productHref = first?.slug && first.sku ? `/p/${first.slug}/${first.sku}` : '/shop';

  return (
    <Card as="article" className="p-5" aria-busy={busy || undefined} data-testid="subscription-card" data-state={s.state}>
      <div className="grid gap-4 min-[900px]:grid-cols-[72px_1fr_auto] min-[900px]:items-start">
        <div className="relative w-[72px]">
          <LineImage url={first?.imageUrl ?? undefined} alt="" width={72} height={88} />
          {extra > 0 ? (
            <span className="absolute bottom-1 left-1 rounded-pill bg-ink px-2 py-0.5 text-[11px] font-semibold text-surface">{t('account.moreLines', { count: extra })}</span>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-display text-[16px] font-semibold text-ink">{first?.name}</h3>
            <StatusPill state={s.state} />
          </div>
          <ul className="m-0 mt-1 list-none p-0 text-[13.5px] text-ink-2">
            {s.lines.map((l) => (
              <li key={l.lineId}>
                {s.lines.length > 1 ? `${l.name}, ` : ''}
                {[l.variantLabel, t('account.quantity', { count: l.quantity })].filter(Boolean).join(', ')}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[14px] font-semibold text-ink" data-testid="subscription-interval">
            {s.schedule ? interval(s.schedule) : t('account.customSchedule')}
          </p>
          {active && s.nextOrderDate ? (
            <p className="m-0 mt-0.5 text-[13.5px] text-ink-2" data-testid="subscription-next">
              {t('account.next', { date: date(s.nextOrderDate) })}
            </p>
          ) : null}
          {skipPending && (s.state === 'active' || s.state === 'paused') ? (
            <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-ink-2" data-testid="subscription-skipped">
              {t('account.skippedLabel')}
            </p>
          ) : null}
          {s.lastOrderDate ? <p className="m-0 mt-0.5 text-[13.5px] text-ink-3">{t('account.last', { date: date(s.lastOrderDate) })}</p> : null}
          {s.state === 'paused' ? <p className="m-0 mt-0.5 text-[13.5px] text-ink-2">{t('account.pausedText')}</p> : null}
          {s.state === 'failed' ? (
            <p className="m-0 mt-0.5 text-[13.5px] text-danger-text">
              {t('account.failed')}{' '}
              <Link href={contactHref()} className="font-medium text-ink underline underline-offset-2">
                {t('account.contact')}
              </Link>
            </p>
          ) : null}
          <p className="m-0 mt-2 text-[14px] text-ink" data-testid="subscription-total">
            {t('account.perDelivery', { amount: money(s.total) })}
          </p>
          {s.priceSelectionMode === 'fixed' ? <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">{t('priceLock')}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 min-[900px]:max-w-[260px] min-[900px]:justify-end max-[519px]:flex-col">
          {active ? (
            <>
              <Button variant="ghost" disabled={busy || skipPending} onClick={() => void run({ action: 'skip' }, () => t('toast.skipped'))} className={BTN}>
                {t('action.skip')}
              </Button>
              <Button variant="ghost" disabled={busy || skipPending} onClick={() => setDialog('interval')} className={BTN}>
                {t('action.changeInterval')}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void run({ action: 'pause' }, () => t('toast.paused'))} className={BTN}>
                {t('action.pause')}
              </Button>
            </>
          ) : null}
          {s.state === 'paused' ? (
            <Button variant="ink" disabled={busy} onClick={() => void run({ action: 'resume' }, () => t('toast.resumed'))} className={BTN}>
              {t('action.resume')}
            </Button>
          ) : null}
          {s.state === 'canceled' ? (
            <Link href={productHref} className="inline-flex min-h-11 items-center text-[14px] font-medium text-ink underline underline-offset-2">
              {t('action.subscribeAgain')}
            </Link>
          ) : null}
          {s.state === 'active' || s.state === 'paused' || s.state === 'failed' ? (
            <Button variant="ghost" disabled={busy} onClick={() => setDialog('cancel')} className={BTN}>
              {t('action.cancel')}
            </Button>
          ) : null}
        </div>
      </div>
      {active && skipPending ? <p className="m-0 mt-3 text-[12.5px] text-ink-3">{t('dialog.interval.blockedBySkip')}</p> : null}

      <ChangeIntervalDialog
        open={dialog === 'interval'}
        currentPolicyId={s.policyId}
        busy={busy}
        onClose={() => setDialog(null)}
        onSave={(policyId) => void run({ action: 'setInterval', recurrencePolicyId: policyId }, () => t('toast.intervalUpdated'))}
      />
      <CancelDialog
        open={dialog === 'cancel'}
        lastOrderDate={s.lastOrderDate}
        busy={busy}
        onKeep={() => setDialog(null)}
        onConfirm={() =>
          void run({ action: 'cancel' }, (after) =>
            after.lastOrderDate ? t('toast.canceled', { date: date(after.lastOrderDate) }) : t('toast.canceledNone'),
          )
        }
      />
    </Card>
  );
}
