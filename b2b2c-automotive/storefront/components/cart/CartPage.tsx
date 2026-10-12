// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { CartLine } from '@/components/cart/CartLine';
import { DeliveryChoice } from '@/components/cart/DeliveryChoice';
import { EmptyCart } from '@/components/cart/EmptyCart';
import { FitWarning } from '@/components/cart/FitWarning';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { PromoCodeForm } from '@/components/cart/PromoCodeForm';
import { useCartContext } from '@/context/CartProvider';
import { useGarage } from '@/hooks/useGarage';
import { countMisfits, getLineFit } from '@/lib/fit';

/**
 * The cart page (workstream N, design view `cart`): lines with a stepper, the delivery choice, the promo code and the summary with a
 * sticky column from 680 px; one column below. Fit is recomputed live from the garage's active vehicle, so changing the vehicle updates
 * the warning without a request; it never blocks Checkout.
 */
export function CartPage({ store }: { store: string }) {
  const t = useTranslations('cart');
  const { cart, notice, error, lastPromo, setQuantity, removeLine, setDelivery, applyCode, removeCode } = useCartContext();
  const { active } = useGarage();
  const partsHref = `/${store}/parts`;

  const lines = cart?.lines ?? [];
  const fits = getLineFit(lines, active);
  const misfit = countMisfits(fits);
  const blocked = lines.some((line) => line.stock.available === 0);

  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <h1 className="m-0 font-display text-2xl font-semibold text-text">{t('title')}</h1>
      <div role="status" className="grid gap-2 empty:hidden">
        {notice === 'capped' ? <p className="m-0 rounded-sm bg-warning-50 p-3 font-ui text-sm text-text-body">{t('noticeCapped')}</p> : null}
        {notice === 'out-of-stock' ? <p className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">{t('noticeOutOfStock')}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="m-0 rounded-sm bg-danger-50 p-3 font-ui text-sm text-danger-600">
          {t('error')}
        </p>
      ) : null}
      {!cart || lines.length === 0 ? (
        <EmptyCart browseHref={partsHref} />
      ) : (
        <div className="grid items-start gap-6 min-[42.5rem]:grid-cols-3">
          <div className="grid min-w-0 gap-3 min-[42.5rem]:col-span-2">
            {active ? <FitWarning count={misfit} vehicle={active.label} alternativesHref={partsHref} /> : null}
            <ul aria-label={t('itemsLabel')} className="m-0 grid list-none gap-3 p-0">
              {lines.map((line) => (
                <CartLine
                  key={line.id}
                  line={line}
                  store={store}
                  fit={fits[line.id]}
                  vehicleLabel={active?.label ?? null}
                  unpriced={cart.unpricedSkus.includes(line.sku)}
                  onQuantity={(id, quantity) => void setQuantity(id, quantity)}
                  onRemove={(id) => void removeLine(id)}
                  alternativesHref={partsHref}
                />
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-4 min-[42.5rem]:sticky min-[42.5rem]:top-4">
            <section aria-label={t('delivery.title')} className="grid gap-3 rounded-md border border-border bg-surface p-5">
              <h2 className="m-0 font-display text-lg font-semibold text-text">{t('delivery.title')}</h2>
              <DeliveryChoice options={cart.delivery.options} selected={cart.delivery.selected} onSelect={(mode) => void setDelivery(mode)} />
              <PromoCodeForm codes={cart.promoCodes} rejected={lastPromo} onApply={applyCode} onRemove={removeCode} />
            </section>
            <OrderSummary totals={cart.totals} hasSubscription={cart.hasSubscription} checkoutHref={`/${store}/checkout`} checkoutBlocked={blocked} />
          </div>
        </div>
      )}
    </div>
  );
}
