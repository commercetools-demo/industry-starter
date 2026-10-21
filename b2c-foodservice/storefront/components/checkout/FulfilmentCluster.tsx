'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { linesOf } from '@/components/cart/use-cart-ui';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import type { Cart, CartGroup } from '@/lib/types';
import ClusterLine from './ClusterLine';

/**
 * One fulfilment cluster on the Review stage (D-033): a heading with its promise, an optional extra block (the pickup card), then
 * every line that belongs to it. A cluster with no lines is not rendered, and `cart.groups` puts each line in exactly one.
 */
export default function FulfilmentCluster({ cart, group, children }: { cart: Cart; group: CartGroup; children?: ReactNode }) {
  const t = useTranslations('checkout.cluster');
  const lines = linesOf(cart, group.lineIds);
  if (lines.length === 0) return null;
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const title =
    group.kind === 'collect' ? t('collect', { store: group.store?.name ?? '' }) : group.kind === 'delivery' ? t('delivery') : t('subscribe');
  const sub = group.kind === 'collect' ? t('collectCount', { count }) : group.kind === 'delivery' ? t('deliveryCount', { count }) : t('subscribeCount', { count });
  const icon = group.kind === 'collect' ? 'store' : group.kind === 'delivery' ? 'truck' : 'repeat';
  return (
    <Card as="section" data-group={group.key} className="mb-5 px-5 pb-2 pt-5 mobile:px-7">
      <div className="mb-2 flex items-start gap-3">
        <span className={group.kind === 'collect' ? 'text-accent' : 'text-ink-2'}>
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 font-display text-[17px] font-semibold">{title}</h3>
          <p className="m-0 mt-0.5 text-[13px] text-ink-3">{sub}</p>
        </div>
      </div>
      {children}
      <ul className="m-0 list-none p-0">
        {lines.map((line) => (
          <ClusterLine key={line.id} line={line} />
        ))}
      </ul>
    </Card>
  );
}
