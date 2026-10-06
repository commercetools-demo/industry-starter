'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardMeta, CardTitle } from '@/components/ui/Card';
import { Photo } from '@/components/ui/Photo';
import { PriceBlock } from '@/components/product/PriceBlock';
import { useCartContext } from '@/context/CartProvider';
import { Link } from '@/i18n/routing';
import type { Product } from '@/lib/types';

/**
 * One saved product. "Add to bag": a single variant in stock goes straight into the bag, several variants open the
 * product page (the shopper has to choose), and a product with nothing in stock shows a disabled "Out of stock".
 */
export function SavedCard({ product, onRemove, removing }: { product: Product; onRemove: (product: Product) => void; removing: boolean }) {
  const t = useTranslations('account.saved');
  const { addItemWithToast } = useCartContext();
  const [busy, setBusy] = useState(false);
  const variant = product.variants[0];
  const inStock = product.variants.some((v) => v.availability.isOnStock);
  const needsChoice = product.variants.length > 1;

  const add = async () => {
    if (!variant || busy) return;
    setBusy(true);
    try {
      await addItemWithToast(variant.sku, 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex h-full flex-col gap-(--space-3) p-(--space-3)" data-product-id={product.id}>
      <Link href={`/p/${product.slug}`} className="block text-text no-underline" aria-label={product.name}>
        <Photo src={variant?.images[0] ?? ''} alt={product.name} sizes="(min-width: 75rem) 270px, 50vw" className="h-[270px]" />
      </Link>
      <div className="flex items-baseline justify-between gap-(--space-3)">
        <CardTitle className="m-0">
          <Link href={`/p/${product.slug}`} className="text-text no-underline">
            {product.name}
          </Link>
        </CardTitle>
        <PriceBlock price={variant?.price} className="flex-none text-[15px]" />
      </div>
      {product.brand ? <CardMeta>{product.brand}</CardMeta> : null}
      <div className="mt-auto flex flex-col gap-(--space-2)">
        {!inStock ? (
          <Button disabled aria-disabled="true">
            {t('outOfStock')}
          </Button>
        ) : needsChoice ? (
          <Button href={`/p/${product.slug}`} aria-label={t('viewLabel', { name: product.name })}>
            {t('addToBag')}
          </Button>
        ) : (
          <Button disabled={busy} aria-label={t('addLabel', { name: product.name })} onClick={() => void add()}>
            {t('addToBag')}
          </Button>
        )}
        <Button variant="ghost" disabled={removing} aria-label={t('removeLabel', { name: product.name })} onClick={() => onRemove(product)}>
          {t('remove')}
        </Button>
      </div>
    </Card>
  );
}
