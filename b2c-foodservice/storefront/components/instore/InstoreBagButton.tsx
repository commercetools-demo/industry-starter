'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useCartCount } from '@/hooks/useCartCount';
import { Link } from '@/i18n/routing';

/** The bag in the header: a 48 px link to `/bag` with the unit count (hidden at 0). */
export default function InstoreBagButton() {
  const t = useTranslations('instore.header');
  const count = useCartCount();
  return (
    <Link
      href="/bag"
      aria-label={t('bag', { count })}
      data-testid="instore-bag-link"
      className="transition-press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-pill border border-line-2 bg-surface text-ink hover:border-ink"
    >
      <Icon name="bag" size={24} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-testid="cart-badge"
          className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-pill bg-accent px-1.5 font-mono text-[12px] font-bold text-surface"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
