'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { useCart } from '@/hooks/useCart';
import { cx } from '@/lib/cx';

const PILL =
  'inline-flex min-h-11 min-w-36 items-center justify-center rounded-pill bg-brand-950 px-6 py-3 font-display text-sm font-semibold tracking-ui text-text-on-pink no-underline whitespace-nowrap';

/** Presentational: "My bundle" for 0 (and while the cart is loading), "My bundle · N" from 1. The width does not change with the count. */
export function BundlePill({ count = 0 }: { count?: number }): ReactElement {
  const t = useTranslations('shell.bundle');
  const label = count > 0 ? t('labelCount', { count }) : t('label');
  return (
    <Link href="/bundle" aria-label={label} className={cx(PILL, FOCUS_RING_ON_BRAND)}>
      {label}
    </Link>
  );
}

/** The header pill connected to the bundle (workstream M): the count comes from the server cart, never from client arithmetic. */
export function ConnectedBundlePill(): ReactElement {
  const { itemCount } = useCart();
  return <BundlePill count={itemCount} />;
}
