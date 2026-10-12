// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useCartSummary } from '@/hooks/useCartSummary';
import { Link } from '@/i18n/routing';

/** "Cart · 3": units (not lines) from `GET /api/cart/summary`. Links to the cart page (no mini-cart in this phase, D9). */
export function CartButton({ store }: { store: string }) {
  const t = useTranslations('shell.cart');
  const { count } = useCartSummary();
  return (
    <Link
      href={`/${store}/cart`}
      className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-sm bg-brand-50 px-3 font-display text-sm font-medium text-brand-700 hover:bg-brand-100"
    >
      {t('label', { count })}
    </Link>
  );
}
