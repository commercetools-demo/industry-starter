// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The buy box of the product page (workstream M). Reuse for the cart (workstream N): `QuantityStepper` and `AddToCartButton`
// are exported on their own; `PdpBuyBox` composes fit banner, price, availability, purchase mode, quantity and add to cart.
//   <PdpBuyBox product={{ ...detail }} branch={…} canChangeStore shipDays={…} store={store} returnDays={30} sellerName={…}
//              subscriptionsEnabled alternativesHref={…} />
// State that must survive a vehicle or store change (quantity, purchase mode, frequency) lives HERE, above the parts that the
// server re-renders (`router.refresh()` re-sends price, stock and branch as props; this component keeps its state).
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCartButton } from '@/components/product/detail/AddToCartButton';
import { AvailabilityBlock, type PdpBranch } from '@/components/product/detail/AvailabilityBlock';
import { BundleContents } from '@/components/product/detail/BundleContents';
import { PriceBlock } from '@/components/product/detail/PriceBlock';
import { PurchaseModeChoice, type PurchaseMode } from '@/components/product/detail/PurchaseModeChoice';
import { QuantityStepper } from '@/components/product/detail/QuantityStepper';
import { SellerLine } from '@/components/product/detail/SellerLine';
import { Select } from '@/components/ui/Select';
import { FitBanner } from '@/components/vehicle/FitBanner';
import { useGarage } from '@/hooks/useGarage';
import { useSubscriptionPolicies } from '@/hooks/useSubscriptionPolicies';
import { usePathname, useRouter } from '@/i18n/routing';
import { getFitState } from '@/lib/search/fitment';
import type { BundleView, ProductDetail } from '@/lib/types';

export interface PdpBuyBoxProps {
  product: Pick<ProductDetail, 'sku' | 'variants' | 'price' | 'stock' | 'fitmentKeys' | 'universalFit' | 'recurringEligible'>;
  branch: PdpBranch | null;
  canChangeStore: boolean;
  shipDays: { min: number; max: number };
  /** Store key of the address: the cart link is `/{store}/cart`. */
  store: string;
  returnDays: number;
  sellerName: string;
  /** `SUBSCRIPTIONS_PURCHASE_ENABLED` (read on the server). */
  subscriptionsEnabled: boolean;
  /** Locale-less address of the listing of fitting alternatives. */
  alternativesHref: string;
  /** Set for a bundle (W-11): its components and how many can be sold. With none available the buy box says "Currently unavailable" and disables Add. */
  bundle?: BundleView | null;
}

export function PdpBuyBox({ product, branch, canChangeStore, shipDays, store, returnDays, sellerName, subscriptionsEnabled, alternativesHref, bundle = null }: PdpBuyBoxProps) {
  const t = useTranslations('pdp');
  const router = useRouter();
  const pathname = usePathname();
  const { active } = useGarage();
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<PurchaseMode>('one-time');
  const [policyChoice, setPolicyChoice] = useState<string | undefined>();

  const bundleBlocked = bundle !== null && bundle.available < 1;
  const offerSubscription = subscriptionsEnabled && product.recurringEligible && bundle === null;
  const { policies } = useSubscriptionPolicies(offerSubscription);
  const showChoice = offerSubscription && policies.length > 0;
  const subscribing = showChoice && mode === 'subscribe';
  const policyKey = policyChoice && policies.some((p) => p.key === policyChoice) ? policyChoice : policies[0]?.key;
  const policy = policies.find((p) => p.key === policyKey);

  const fit = getFitState(product, active);
  const misfit = fit === 'does-not-fit' && active ? { vehicle: active.label, alternativesHref } : null;

  return (
    <div className="grid gap-4">
      <FitBanner product={product} alternativesHref={alternativesHref} />
      <PriceBlock price={product.price} />
      {bundle ? <BundleContents bundle={bundle} /> : null}
      {bundle === null || !bundleBlocked ? (
        <AvailabilityBlock branch={branch} canChangeStore={canChangeStore} inStock={bundle ? true : product.stock.atBranch} shipDays={shipDays} />
      ) : null}
      {product.variants.length > 1 ? (
        <Select label={t('option')} value={product.sku} onChange={(event) => router.replace(`${pathname}?sku=${encodeURIComponent(event.target.value)}`)}>
          {product.variants.map((variant) => (
            <option key={variant.sku} value={variant.sku}>
              {variant.sku}
            </option>
          ))}
        </Select>
      ) : null}
      {showChoice ? <PurchaseModeChoice mode={mode} onModeChange={setMode} policies={policies} policyKey={policyKey} onPolicyChange={setPolicyChoice} price={product.price} /> : null}
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <AddToCartButton
        sku={product.sku}
        quantity={quantity}
        hasPrice={product.price !== null}
        subscription={subscribing && policy ? { key: policy.key, label: policy.label } : null}
        disabled={(subscribing && !policy) || bundleBlocked}
        misfit={misfit}
        cartHref={`/${store}/cart`}
      />
      <SellerLine reseller={sellerName} days={returnDays} />
    </div>
  );
}
