'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useShellUi } from '@/context/shell-ui-context';
import { useCartCount } from '@/hooks/useCartCount';
import { useRouter } from '@/i18n/routing';

/**
 * Bag icon with a unit-count badge (hidden at 0). Opens the cart drawer when workstream I has mounted one
 * (`useShellUi().registerCartDrawer(true)`); until then it goes to /cart.
 */
export default function CartButton() {
  const t = useTranslations('shell.cart');
  const count = useCartCount();
  const { openCart, cartDrawerMounted } = useShellUi();
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={t('aria', { count })}
      onClick={() => (cartDrawerMounted ? openCart() : router.push('/cart'))}
      className="transition-state relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border-0 bg-transparent text-ink hover:bg-ink/6"
    >
      <Icon name="bag" size={20} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-testid="cart-badge"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 font-mono text-[10px] font-bold text-surface"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
