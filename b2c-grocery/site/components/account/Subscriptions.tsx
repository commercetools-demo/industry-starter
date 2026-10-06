'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Radio } from '@/components/ui/Radio';
import { Tag } from '@/components/ui/Tag';
import { useRecurring, useRecurringMutations } from '@/hooks/useRecurring';
import type { RecurringOrderSummary } from '@/lib/types';
import { formatDate } from './format';

const STATE_TONE: Record<RecurringOrderSummary['state'], 'accent' | 'accent-2' | 'neutral'> = {
  Active: 'accent-2',
  Paused: 'accent',
  Canceled: 'neutral',
  Other: 'neutral',
};

type Policy = { key: string; name: string };

function CadenceDialog({
  order,
  policies,
  onClose,
  onSave,
  pending,
  failed,
}: {
  order: RecurringOrderSummary | null;
  policies: Policy[];
  onClose: () => void;
  onSave: (policyKey: string) => void;
  pending: boolean;
  failed: boolean;
}) {
  const t = useTranslations('subscription.manage.cadenceDialog');
  const tm = useTranslations('subscription.manage');
  // The dialog is keyed by order id (see below), so the initial choice is the order's current policy.
  const [choice, setChoice] = useState(order?.policyKey ?? '');
  return (
    <Dialog open={order !== null} onClose={onClose} title={t('title')}>
      {order ? (
        <>
          <p className="m-0 text-[15px]">{t('body')}</p>
          <div role="radiogroup" aria-label={t('label')} className="flex flex-col gap-(--space-2)">
            {policies.map((policy) => (
              <Radio key={policy.key} name={`cadence-${order.id}`} value={policy.key} label={policy.name} checked={choice === policy.key} onChange={() => setChoice(policy.key)} />
            ))}
          </div>
          {failed ? (
            <p role="alert" className="m-0 text-[14px] text-accent-700">
              {tm('actionFailed')}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-(--space-3)">
            <Button variant="ghost" onClick={onClose}>
              {t('keep')}
            </Button>
            <Button onClick={() => onSave(choice)} disabled={pending || choice === '' || choice === order.policyKey}>
              {pending ? t('saving') : t('save')}
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

function CancelDialog({ order, onClose, onConfirm, pending, failed }: { order: RecurringOrderSummary | null; onClose: () => void; onConfirm: () => void; pending: boolean; failed: boolean }) {
  const t = useTranslations('subscription.manage.cancelDialog');
  const tm = useTranslations('subscription.manage');
  const locale = useLocale();
  return (
    <Dialog open={order !== null} onClose={onClose} title={t('title')}>
      {order ? (
        <>
          <p className="m-0 text-[15px]">{order.lastOrderAt ? t('body', { date: formatDate(order.lastOrderAt, locale) }) : t('bodyNoDate')}</p>
          {failed ? (
            <p role="alert" className="m-0 text-[14px] text-accent-700">
              {tm('actionFailed')}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-(--space-3)">
            <Button variant="ghost" onClick={onClose}>
              {t('keep')}
            </Button>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? t('canceling') : t('confirm')}
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

function NextLine({ order }: { order: RecurringOrderSummary }) {
  const t = useTranslations('subscription.manage');
  const locale = useLocale();
  if (order.nextOrderAt && order.state === 'Active') return <>{t('next', { date: formatDate(order.nextOrderAt, locale) })}</>;
  if (order.state === 'Paused') return <>{t('pausedNext')}</>;
  if (order.state === 'Canceled') return <>{t('canceledNext')}</>;
  return <>{t('inactiveNext')}</>;
}

function SubscriptionCard({
  order,
  busy,
  onQuantity,
  onChangeCadence,
  onPause,
  onResume,
  onCancel,
}: {
  order: RecurringOrderSummary;
  busy: boolean;
  onQuantity: (lineId: string, quantity: number) => void;
  onChangeCadence: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('subscription.manage');
  const locale = useLocale();
  const live = order.state === 'Active' || order.state === 'Paused';
  return (
    <li>
      <Card elev="sm" className="flex flex-col gap-(--space-3) p-[17.6px]" data-testid="subscription-card">
        <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
          <h3 className="m-0 text-[22px]">
            <span className="sr-only">{t('cadence')}: </span>
            {order.cadenceLabel}
          </h3>
          <Tag tone={STATE_TONE[order.state]}>{t(`state.${order.state}`)}</Tag>
        </div>
        <ul aria-label={t('items')} className="m-0 flex list-none flex-col gap-(--space-2) p-0">
          {order.lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-(--space-2) text-[15px]">
              <span>{line.name}</span>
              {live ? (
                <QuantityStepper
                  value={line.quantity}
                  min={1}
                  label={t('quantityOf', { name: line.name })}
                  decreaseLabel={t('decrease', { name: line.name })}
                  increaseLabel={t('increase', { name: line.name })}
                  disabled={busy}
                  onChange={(quantity) => onQuantity(line.id, quantity)}
                />
              ) : (
                <span>× {line.quantity}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="text-[15px]" data-testid="next-order">
          <NextLine order={order} />
        </div>
        {order.lastOrderAt ? <div className="card-meta">{t('last', { date: formatDate(order.lastOrderAt, locale) })}</div> : null}
        {live ? (
          <div className="mt-auto flex flex-wrap gap-(--space-2)">
            <Button variant="secondary" onClick={onChangeCadence} disabled={busy}>
              {t('changeCadence')}
            </Button>
            {order.state === 'Active' ? (
              <Button variant="ghost" onClick={onPause} disabled={busy}>
                {t('pause')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onResume} disabled={busy}>
                {t('resume')}
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

/** The subscriptions page body: a card per recurring order (items with quantity stepper, cadence, state, next order date, actions), empty state, dialogs. */
export function Subscriptions() {
  const t = useTranslations('subscription.manage');
  const { recurringOrders, policies, error, isLoading, mutate } = useRecurring();
  const m = useRecurringMutations();
  const [cadenceId, setCadenceId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (id: string, work: () => Promise<unknown>): Promise<boolean> => {
    setBusyId(id);
    setFailed(false);
    let ok = true;
    try {
      await work();
    } catch {
      ok = false;
      setFailed(true);
    }
    setBusyId(null);
    return ok;
  };

  if (isLoading && recurringOrders.length === 0) {
    return (
      <p aria-busy="true" className="m-0 text-[15px] text-text/60">
        {t('loading')}
      </p>
    );
  }
  if (error && recurringOrders.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-start gap-(--space-3)">
        <p className="m-0 text-[15px]">{t('loadFailed')}</p>
        <Button variant="secondary" onClick={() => void mutate()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const cadenceOrder = recurringOrders.find((r) => r.id === cadenceId) ?? null;
  const cancelOrder = recurringOrders.find((r) => r.id === cancelId) ?? null;

  return (
    <div className="flex flex-col gap-(--space-4)">
      {recurringOrders.length === 0 ? (
        <div className="flex flex-col items-start gap-(--space-3)">
          <p className="m-0 text-[17px] text-text/60">{t('empty')}</p>
          <p className="m-0 text-[15px] text-text/60">{t('emptyHint')}</p>
          <Button href="/shop">{t('browse')}</Button>
        </div>
      ) : (
        <>
          <p className="m-0 text-[15px] text-text/75">{t('intro')}</p>
          <ul aria-label={t('list')} className="m-0 grid list-none gap-(--space-4) p-0 tablet:grid-cols-2">
            {recurringOrders.map((order) => (
              <SubscriptionCard
                key={order.id}
                order={order}
                busy={busyId === order.id}
                onQuantity={(lineId, quantity) => void run(order.id, () => m.setQuantity(order.id, lineId, quantity))}
                onChangeCadence={() => setCadenceId(order.id)}
                onPause={() => void run(order.id, () => m.pause(order.id))}
                onResume={() => void run(order.id, () => m.resume(order.id))}
                onCancel={() => setCancelId(order.id)}
              />
            ))}
          </ul>
        </>
      )}
      {failed && !cadenceOrder && !cancelOrder ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {t('actionFailed')}
        </p>
      ) : null}
      <CadenceDialog
        key={cadenceOrder?.id ?? 'none'}
        order={cadenceOrder}
        policies={policies}
        pending={busyId !== null && busyId === cadenceId}
        failed={failed}
        onClose={() => setCadenceId(null)}
        onSave={(policyKey) => {
          if (cadenceOrder) void run(cadenceOrder.id, () => m.setCadence(cadenceOrder.id, policyKey)).then((ok) => ok && setCadenceId(null));
        }}
      />
      <CancelDialog
        order={cancelOrder}
        pending={busyId !== null && busyId === cancelId}
        failed={failed}
        onClose={() => setCancelId(null)}
        onConfirm={() => {
          if (cancelOrder) void run(cancelOrder.id, () => m.cancel(cancelOrder.id)).then((ok) => ok && setCancelId(null));
        }}
      />
    </div>
  );
}
