// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { CheckoutWidget } from '@/components/checkout/CheckoutWidget';
import { DevCompletePanel } from '@/components/checkout/DevCompletePanel';
import { PickupPanel } from '@/components/checkout/PickupPanel';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { CheckoutPickup } from '@/lib/types';

interface Props {
  store: string;
  /** Present when the cart's delivery preset is pickup. */
  pickup: CheckoutPickup | null;
  /** The shopper came back from a cancelled or expired payment. */
  cancelled: boolean;
  /** Server-decided: the dev-only completion helper is on and the Application key is missing or `?dev=1` (never in production). */
  devComplete: boolean;
}

/**
 * The checkout page (design view `checkout`, owner decision Q-012, accepted deviation M-O04): our chrome around the hosted commercetools
 * Checkout. The hosted widget owns contact, delivery, payment, agreements, summary and the Place order button; this page adds the pickup
 * facts (address, hours, "Bring photo ID") and the way back to the cart.
 */
export function CheckoutPage({ store, pickup, cancelled, devComplete }: Props) {
  const t = useTranslations('checkout');
  const cartHref = `/${store}/cart`;
  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <h1 className="m-0 font-display text-2xl font-semibold text-text">{t('title')}</h1>
      <p className="m-0 font-ui text-sm text-text-muted">{t('secureNote')}</p>
      {cancelled ? (
        <p role="status" className="m-0 rounded-sm bg-warning-50 p-3 font-ui text-sm text-text-body">
          {t('cancelledNotice')}
        </p>
      ) : null}
      {pickup ? <PickupPanel pickup={pickup} /> : null}
      {devComplete ? <DevCompletePanel /> : null}
      <CheckoutWidget cartHref={cartHref} />
      <div>
        <Link href={cartHref} className={buttonClass('link')}>
          {t('backToCart')}
        </Link>
      </div>
    </div>
  );
}
