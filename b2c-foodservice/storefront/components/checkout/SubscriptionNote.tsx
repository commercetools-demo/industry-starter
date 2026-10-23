'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useDateLabel } from '@/components/account/subscriptions/format';
import { useIntervalLabel } from '@/components/cart/use-cart-ui';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import type { OrderView } from '@/lib/types';

/** Retries while the platform creates the recurring orders (a few seconds after the order). */
export const NOTE_RETRY_MS = [5000, 15000] as const;
const GIVE_UP_MS = 16000;

/**
 * Next delivery note of the confirmation page (workstream N, D10). Reads the recurring orders created from this order. While
 * there is none it says the subscription is being set up, retries after 5 s and 15 s, then says it will appear in the account.
 * The order itself is never touched. A guest order has no subscribe lines (guest rule), so nothing is shown for it.
 */
export default function SubscriptionNote({ order }: { order: Pick<OrderView, 'id' | 'customerId' | 'subscriptions'> }) {
  const t = useTranslations('subscription.confirmation');
  const date = useDateLabel();
  const interval = useIntervalLabel();
  const enabled = Boolean(order.customerId) && order.subscriptions.length > 0;
  const { subscriptions, mutate } = useSubscriptions({ originOrderId: order.id, enabled });
  const found = subscriptions.find((s) => s.state === 'active' || s.state === 'paused') ?? subscriptions[0];
  const [late, setLate] = useState(false);

  useEffect(() => {
    if (!enabled || found) return;
    const timers = [
      ...NOTE_RETRY_MS.map((ms) => setTimeout(() => void mutate(), ms)),
      setTimeout(() => setLate(true), GIVE_UP_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [enabled, found, mutate]);

  if (!enabled) return null;
  if (found) {
    const label = found.schedule ? interval(found.schedule) : '';
    return (
      <p className="m-0 mt-2 text-[13.5px] text-ink-2" data-testid="subscription-note">
        {found.nextOrderDate
          ? t('active', { date: date(found.nextOrderDate), interval: label ? label.charAt(0).toLowerCase() + label.slice(1) : '' })
          : t('settingUp')}
      </p>
    );
  }
  return (
    <p role="status" className="m-0 mt-2 text-[13.5px] text-ink-2" data-testid="subscription-note">
      {late ? t('late') : t('settingUp')}
    </p>
  );
}
