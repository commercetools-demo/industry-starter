import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FOCUS_RING_ON_BRAND } from '@/components/ui/focus';
import { cx } from '@/lib/cx';

/** Presentational: the count comes from the caller (M connects it to the cart with `countBundleLines`). */
export function BundlePill({ count }: { count: number }): ReactElement {
  const t = useTranslations('shell.bundle');
  const label = t('labelCount', { count });
  return (
    <Link
      href="/bundle"
      aria-label={label}
      className={cx('inline-flex min-h-11 items-center rounded-pill bg-brand-950 px-6 py-3 font-display text-sm font-semibold tracking-ui text-text-on-pink no-underline whitespace-nowrap', FOCUS_RING_ON_BRAND)}
    >
      {label}
    </Link>
  );
}
