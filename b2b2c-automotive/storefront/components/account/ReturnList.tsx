// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Panel, StateMessage } from '@/components/account/Panel';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import { isReturnReason } from '@/lib/contracts/return-item';
import type { ReturnView } from '@/lib/types';

const TONE: Record<ReturnView['status'], BadgeTone> = { requested: 'neutral', 'in-transit': 'info', received: 'info', inspected: 'info', refunded: 'success', rejected: 'danger' };

/** The shopper's returns with the portal's status words (the reseller moves them through the lifecycle) and a link to the order. */
export function ReturnList({ store, returns, timeZone }: { store: string; returns: ReturnView[]; timeZone?: string }) {
  const t = useTranslations('account.returns');
  const tr = useTranslations('account.return');
  const locale = useLocale();
  if (returns.length === 0) {
    return (
      <StateMessage
        kind="empty"
        title={t('empty')}
        hint={<p className="m-0 font-ui text-sm text-text-body">{t('emptyHint')}</p>}
        action={
          <Link href={`/${store}/account/orders`} className={buttonClass('primary')}>
            {t('emptyCta')}
          </Link>
        }
      />
    );
  }
  return (
    <Panel>
      <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-3 p-0">
        {returns.map((r) => (
          <li key={r.returnNumber} className="grid gap-2 rounded-sm border border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-md font-semibold text-text">{t('reference', { number: r.returnNumber })}</span>
              <Badge tone={TONE[r.status]}>{t(`status.${r.status}` as 'status.requested')}</Badge>
            </div>
            <p className="m-0 font-ui text-sm text-text-muted">
              {r.tracking ? `${t('tracking', { tracking: r.tracking })} · ` : ''}
              {t('requestedOn', { date: formatDate(r.requestedAt, locale, timeZone) })}
            </p>
            <ul className="m-0 grid list-none gap-1 p-0 font-ui text-sm text-text-body">
              {r.items.map((item) => (
                <li key={item.lineItemId}>
                  {item.quantity} × {item.name}
                </li>
              ))}
            </ul>
            {r.reason && isReturnReason(r.reason) ? (
              <p className="m-0 font-ui text-sm text-text-body">
                {t('reasonLabel')}: {tr(`reasons.${r.reason}` as 'reasons.other')}
              </p>
            ) : null}
            <Link href={`/${store}/account/orders/${r.orderNumber}`} className="font-utility text-sm text-text-link underline-offset-2 hover:underline">
              {t('order', { number: r.orderNumber })}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
