'use client';

import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/lib/types';

/**
 * Slide-up button on the card image. No required choice: adds the default variant as a delivery line (Q-G-02) and
 * toasts. With a required choice (coffee grind, machine colour) it opens the product page with the choice highlighted
 * and adds nothing. Disabled without a price.
 */
export default function QuickAdd({ product }: { product: ProductSummary }) {
  const t = useTranslations('card');
  const tShell = useTranslations('shell.toast');
  const toast = useToast();
  const router = useRouter();
  const { add, isAdding } = useAddToCart();

  const onClick = async () => {
    if (product.requiredChoice) {
      router.push(`/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(product.sku)}?choose=${product.requiredChoice}`);
      return;
    }
    const cart = await add({ sku: product.sku, quantity: 1, fulfilment: 'delivery' });
    toast.show(cart ? tShell('added') : t('addError'));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={product.price === null || isAdding}
      aria-label={t('quickAddNamed', { name: product.name })}
      data-testid="quick-add"
      className={cn(
        'transition-state absolute inset-x-3 bottom-3 z-20 rounded-pill border-0 bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface hover:bg-ink/90 disabled:pointer-events-none disabled:opacity-40',
        'translate-y-[calc(100%+12px)] group-hover:translate-y-0 group-focus-within:translate-y-0 focus-visible:translate-y-0 [@media(hover:none)]:translate-y-0',
        'motion-reduce:transition-none',
      )}
    >
      {t('quickAdd')}
    </button>
  );
}
