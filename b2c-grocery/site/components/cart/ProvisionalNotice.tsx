import { useTranslations } from 'next-intl';
import type { Cart } from '@/lib/types';

/**
 * Provisional-total messaging for carts (and, in R/V, orders) that contain approximate-weight lines.
 * - `inline`: the explanatory note ("The final amount depends on the weight we pick.").
 * - `total`: the label for the total row ("Total (provisional)").
 * Pass `cart` to render only when `cart.isProvisional`; without `cart` it always renders (orders decide for themselves).
 * Server-safe: no client-only hooks.
 */
export function ProvisionalNotice({ cart, variant = 'inline' }: { cart?: Pick<Cart, 'isProvisional'>; variant?: 'inline' | 'total' }) {
  const t = useTranslations('pricing');
  if (cart && !cart.isProvisional) return null;
  if (variant === 'total') return <span>{t('totalProvisional')}</span>;
  return (
    <p className="m-0 text-[13px] text-muted" data-testid="provisional-note">
      {t('provisionalNote')}
    </p>
  );
}
