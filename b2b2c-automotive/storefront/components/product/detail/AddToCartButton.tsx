// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { useAddToCart } from '@/hooks/useAddToCart';
import { Link } from '@/i18n/routing';

export interface AddToCartButtonProps {
  sku: string;
  quantity: number;
  /** No price for this shopper: the button is disabled (never a line without a price). */
  hasPrice: boolean;
  /** The chosen subscription: the line is added with this recurrence policy and the button reads "Subscribe". */
  subscription?: { key: string; label: string } | null;
  /** Set for a part that does not fit the active vehicle: the status panel repeats the warning (D6). */
  misfit?: { vehicle: string; alternativesHref: string } | null;
  /** Locale-less address of the cart, for "View cart". */
  cartHref: string;
  /** Blocks the button for a reason of the caller (a subscription without a chosen frequency). */
  disabled?: boolean;
}

type Added = { quantity: number; frequency: string | null; misfit: AddToCartButtonProps['misfit'] };

/**
 * Full-width primary "Add to cart" (workstream M; N reuses it). Adds through `useAddToCart` (`POST /api/cart/lines`, which
 * refreshes the header count) and answers with an inline status panel: "{n} added to your cart" with "Continue shopping" and
 * "View cart". A non-fitting part can still be added; the panel then says "This part may not fit your {vehicle}".
 */
export function AddToCartButton({ sku, quantity, hasPrice, subscription, misfit, cartHref, disabled = false }: AddToCartButtonProps) {
  const t = useTranslations('pdp');
  const { add, isAdding, error } = useAddToCart();
  const [added, setAdded] = useState<Added | null>(null);

  async function onAdd() {
    setAdded(null);
    const ok = await add(sku, quantity, subscription ? { recurrencePolicyKey: subscription.key } : undefined);
    if (ok) setAdded({ quantity, frequency: subscription?.label ?? null, misfit: misfit ?? null });
  }

  return (
    <div className="grid gap-3">
      <button type="button" onClick={onAdd} disabled={!hasPrice || isAdding || disabled} className={buttonClass('primary', 'w-full')}>
        {isAdding ? t('adding') : subscription ? t('subscribeAction') : t('addToCart')}
      </button>
      {added ? (
        <div role="status" className="grid gap-2 rounded-sm bg-success-50 p-4 font-ui text-sm text-success-600">
          <p className="m-0 font-semibold">{added.frequency ? t('subscriptionAdded', { frequency: added.frequency }) : t('added', { count: added.quantity })}</p>
          {added.misfit ? (
            <p className="m-0 text-danger-600">
              {t('mayNotFit', { vehicle: added.misfit.vehicle })}{' '}
              <Link href={added.misfit.alternativesHref} className="underline underline-offset-2">
                {t('alternatives')}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setAdded(null)} className={buttonClass('secondary')}>
              {t('continueShopping')}
            </button>
            <Link href={cartHref} className={buttonClass('primary')}>
              {t('viewCart')}
            </Link>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 font-ui text-sm text-danger-600">
          {error === 'price-unavailable' ? t('addPriceMissing') : t('addFailed')}
        </p>
      ) : null}
    </div>
  );
}
