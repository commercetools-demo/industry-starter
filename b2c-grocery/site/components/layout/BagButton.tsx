'use client';

import { ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useCartContext } from '@/context/CartProvider';

/** Header bag button: "Bag" when empty, "Bag · N" (N = distinct lines) otherwise. Links to the cart page. */
export function BagButton() {
  const t = useTranslations('nav');
  const { itemCount } = useCartContext();
  return (
    <Button href="/cart" className="flex-none gap-2 whitespace-nowrap">
      <Icon icon={ShoppingBag} size={16} />
      {itemCount > 0 ? t('bagCount', { count: itemCount }) : t('bag')}
    </Button>
  );
}
