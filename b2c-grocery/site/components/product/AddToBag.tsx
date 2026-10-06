'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { useCartContext } from '@/context/CartProvider';
import type { Product, Variant } from '@/lib/types';
import { RecurrenceSelector } from './RecurrenceSelector';
import { SaveButton } from './SaveButton';

/**
 * Quantity (1 up to the known available quantity), primary "Add to bag" and the heart. Carts use inventory mode None
 * (D-031), so the app checks stock itself: units already in the bag count against the available quantity, and a
 * request that would exceed it is not sent. A race with other shoppers is still answered by the cart API (409) and
 * shown by the toast of `addItemWithToast`.
 */
export function AddToBag({ product, variant }: { product: Product; variant: Variant }) {
  const t = useTranslations('pdp');
  const { addItemWithToast, cart } = useCartContext();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const noteId = useId();

  const inStock = variant.availability.isOnStock;
  const available = variant.availability.availableQuantity;
  const max = inStock && available > 0 ? available : undefined;
  const inBag = cart?.lines.filter((line) => line.sku === variant.sku).reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  const add = async () => {
    if (!inStock || busy) return;
    if (max !== undefined && quantity + inBag > max) {
      setLimit(max);
      return;
    }
    setLimit(null);
    setBusy(true);
    try {
      await addItemWithToast(variant.sku, quantity);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <RecurrenceSelector product={product} variant={variant} />
      <div className="flex items-center gap-(--space-3)">
        <QuantityStepper
          value={quantity}
          min={1}
          max={max}
          disabled={!inStock}
          label={t('quantity')}
          decreaseLabel={t('decrease')}
          increaseLabel={t('increase')}
          onChange={(value) => {
            setLimit(null);
            setQuantity(value);
          }}
        />
        <Button
          className="flex-1 text-[15px]"
          disabled={!inStock || busy}
          aria-disabled={!inStock || busy}
          aria-describedby={!inStock ? noteId : undefined}
          onClick={() => void add()}
        >
          {t('addToBag')}
        </Button>
        <SaveButton productId={product.id} name={product.name} />
      </div>
      {!inStock ? (
        <p id={noteId} className="mt-(--space-2) mb-0 text-[14px] text-muted">
          {t('availability.out')}
        </p>
      ) : null}
      {limit !== null ? (
        <p role="alert" className="mt-(--space-2) mb-0 text-[14px] text-accent-700">
          {t('onlyAvailable', { available: limit })}
        </p>
      ) : null}
    </div>
  );
}
