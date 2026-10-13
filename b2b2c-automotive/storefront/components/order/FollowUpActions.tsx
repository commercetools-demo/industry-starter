// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { CopyLink } from '@/components/order/CopyLink';
import { GuestAccountForm } from '@/components/order/GuestAccountForm';
import { Button, buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { OrderView } from '@/lib/types';

export type Viewer = 'owner' | 'guest' | 'holder';

interface Props {
  view: OrderView;
  store: string;
  /** `owner`: the signed-in customer of the order. `guest`: nobody owns the order yet. `holder`: the order has an account and this is a link holder. */
  viewer: Viewer;
  /** Locale-prefixed path with `?t=` (guests only). */
  privatePath: string | null;
  token?: string;
}

/** Continue shopping for everyone; View order when signed in; Copy link and Create account for a guest. Hidden in print. */
export function FollowUpActions({ view, store, viewer, privatePath, token }: Props) {
  const t = useTranslations('order.actions');
  return (
    <div className="grid gap-4 print:hidden">
      <h2 className="sr-only">{t('title')}</h2>
      <div className="flex flex-wrap gap-3">
        <Link href={`/${store}`} className={buttonClass('primary')}>
          {t('continueShopping')}
        </Link>
        {viewer === 'owner' ? (
          <Link href={`/${store}/account/orders/${view.number}`} className={buttonClass('secondary')}>
            {t('viewOrder')}
          </Link>
        ) : null}
        <Button variant="secondary" onClick={() => window.print()}>
          {t('print')}
        </Button>
      </div>
      {viewer === 'guest' && privatePath ? <CopyLink path={privatePath} /> : null}
      {viewer === 'guest' && view.email ? <GuestAccountForm orderNumber={view.number} store={store} email={view.email} token={token} /> : null}
    </div>
  );
}
