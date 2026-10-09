'use client';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/use-cart';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { cx } from '@/components/ui/cx';

/**
 * Header cart link with the count of cart LINES. The count comes from the session-resolved
 * SWR cart (`useCart`), never from markup: signed out, expired or after sign-out it is absent.
 */
export function CartButton({ className }: { className?: string }) {
  const t = useTranslations('shell');
  const { data: cart } = useCart();
  const count = cart?.lineCount ?? 0;
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `${t('cart')}, ${t('cartCount', { count })}` : undefined}
      className={cx(buttonClasses({ variant: 'outline', size: 'sm' }), className)}
    >
      {t('cart')}
      {count > 0 ? (
        <b aria-hidden="true" data-cart-count className="rounded-pill bg-navy-700 px-1.5 text-xs font-semibold text-text-on-brand">
          {count}
        </b>
      ) : null}
    </Link>
  );
}
