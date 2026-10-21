'use client';

import { useTranslations } from 'next-intl';
import { useIntervalLabel } from '@/components/cart/use-cart-ui';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { accountHref } from '@/lib/routes';
import type { OrderView } from '@/lib/types';

/**
 * The subscription card: each subscribed line with its interval. Next delivery dates and the "setting up your subscription"
 * state belong to workstream N (its `SubscriptionNote` plugs in here); K shows only what the order itself says.
 */
export default function OrderSubscriptionCard({ order }: { order: OrderView }) {
  const t = useTranslations('order.subscription');
  const interval = useIntervalLabel();
  const lines = order.subscriptions.flatMap((s) => {
    const line = order.lines.find((l) => l.id === s.lineId);
    return line ? [{ line, label: interval(s.schedule) }] : [];
  });
  if (lines.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="order-sub-title" data-testid="subscription-card">
      <div className="flex items-start gap-3">
        <span className="text-ink-2">
          <Icon name="repeat" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="order-sub-title" className="m-0 font-display text-[17px] font-semibold">
            {t('title')}
          </h2>
          <ul className="m-0 mt-1 list-none p-0">
            {lines.map(({ line, label }) => (
              <li key={line.id} className="py-0.5 text-[13.5px] text-ink-2">
                {line.name} · {t('every', { interval: label.charAt(0).toLowerCase() + label.slice(1) })}
              </li>
            ))}
          </ul>
          <Link href={accountHref()} className="mt-2 inline-block text-[13.5px] font-medium text-ink underline underline-offset-2">
            {t('manage')}
          </Link>
        </div>
      </div>
    </Card>
  );
}
