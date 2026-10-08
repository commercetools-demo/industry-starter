'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { OrderAutoRefill } from '@/components/auto-refill/OrderAutoRefill';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOrderActions } from '@/hooks/use-orders';
import { Link } from '@/i18n/routing';
import type { OrderStatus, OrderView, ReorderResult } from '@/lib/order-types';
import { formatMoney } from '@/lib/utils';

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  received: 'info',
  'pharmacist-review': 'wait',
  'packed-shipped': 'ok',
  delivered: 'ok',
  cancelled: 'no',
};

/** What a reorder did: what went into the cart and, by name, what could not be added and why. Never silent. */
function ReorderNotice({ result }: { result: ReorderResult }) {
  const t = useTranslations('orders.reorder');
  return (
    <div role="status" data-reorder-result className="grid gap-1 rounded-md bg-info-50 px-3.5 py-2.5 text-sm text-navy-900">
      {result.added.length > 0 ? <p>{t('added', { names: result.added.join(', ') })}</p> : <p>{t('nothing')}</p>}
      {result.notAdded.length > 0 ? <p data-not-added>{t('notAdded', { names: result.notAdded.map((n) => `${n.name} (${t(`reason.${n.reason}`)})`).join(', ') })}</p> : null}
      {result.added.length > 0 ? (
        <Link href="/cart" className="text-text-link">
          {t('viewCart')}
        </Link>
      ) : null}
    </div>
  );
}

function OrderCard({ order, autoRefill }: { order: OrderView; autoRefill: boolean }) {
  const t = useTranslations('orders');
  const locale = useLocale();
  const { reorder } = useOrderActions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReorderResult | null>(null);
  const [failed, setFailed] = useState(false);

  async function onReorder() {
    setBusy(true);
    setFailed(false);
    try {
      setResult(await reorder(order.id));
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="article" className="grid gap-3" data-order-card data-order-status={order.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-meta text-base font-bold text-navy-900">{order.orderNumber}</h2>
          <p className="text-sm text-neutral-600">{order.lines.map((l) => l.name).join(', ')}</p>
        </div>
        <Badge variant={STATUS_VARIANT[order.status]}>{t(`list.status.${order.status}`)}</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <b className="text-navy-900">{formatMoney(order.total.centAmount, order.total.currencyCode, locale)}</b>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" busy={busy} onClick={() => void onReorder()}>
            {t('list.reorder')}
          </Button>
          <ButtonLink href={`/order/${encodeURIComponent(order.id)}`} variant="outline" size="sm">
            {t('list.track')}
          </ButtonLink>
        </div>
      </div>
      {result ? <ReorderNotice result={result} /> : null}
      {autoRefill && order.status !== 'cancelled' ? <OrderAutoRefill orderId={order.id} /> : null}
      {failed ? (
        <p role="alert" className="text-sm text-danger-700">
          {t('reorder.failed')}
        </p>
      ) : null}
    </Card>
  );
}

/** `/account/orders`: the customer's orders, newest first. `orders: null` means the read failed. */
export function OrderList({ orders, autoRefill = false }: { orders: OrderView[] | null; autoRefill?: boolean }) {
  const t = useTranslations('orders.list');
  const empty = useTranslations('account.orders');
  if (orders === null) {
    return (
      <p role="status" className="text-danger-700">
        {t('loadFailed')}
      </p>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        title={empty('empty')}
        action={
          <ButtonLink href="/prescriptions" variant="outline" size="sm">
            {empty('orderFromRx')}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="grid gap-4" data-order-list>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} autoRefill={autoRefill} />
      ))}
    </div>
  );
}
