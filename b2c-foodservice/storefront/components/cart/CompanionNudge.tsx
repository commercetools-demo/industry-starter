'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { useToast } from '@/context/toast';
import { useAddToCart } from '@/hooks/useAddToCart';
import type { Cart } from '@/lib/types';
import { useMoney } from './use-cart-ui';

/**
 * "{machine} needs capsules. Add starter capsules?" for a Vertuo or Original machine with no compatible pods in the bag.
 * The server picks the capsule (`cart.nudge`, the first compatible bestseller); Add puts one delivery line in the bag and
 * the cart is read again, so the totals and the nudge update together. Machines of other systems never get this.
 */
export default function CompanionNudge({ nudge }: { nudge: Cart['nudge'] }) {
  const t = useTranslations('cart.nudge');
  const money = useMoney();
  const toast = useToast();
  const { add, isAdding } = useAddToCart();
  if (!nudge) return null;
  return (
    <div data-testid="companion-nudge" className="mb-4 flex items-center justify-between gap-3 rounded-field bg-canvas-2 px-4 py-3 text-[13px] text-ink">
      <p className="m-0">{t('text', { machine: nudge.machineName })}</p>
      <Button
        variant="accent"
        loading={isAdding}
        aria-label={t('addNamed', { capsule: nudge.name, price: money(nudge.price) })}
        className="shrink-0 !px-4 !py-2 !text-[13px]"
        onClick={async () => {
          const cart = await add({ sku: nudge.sku, quantity: 1, fulfilment: 'delivery' });
          if (cart) toast.show(t('added'));
        }}
      >
        {t('add')}
      </Button>
    </div>
  );
}
