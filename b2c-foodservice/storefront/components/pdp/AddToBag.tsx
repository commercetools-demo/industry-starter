'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { usePdp } from '@/components/pdp/pdp-state';
import Button from '@/components/ui/Button';
import Stepper from '@/components/ui/Stepper';
import { useToast } from '@/context/toast';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { useRouter } from '@/i18n/routing';
import { addButtonState } from '@/lib/product/add-state';
import { lineTotal, recurringTotal } from '@/lib/product/price';
import { PDP_MAX_QUANTITY } from '@/lib/shop-config';
import type { Money } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** Message key under `pdp.error.*` for an add-to-bag failure code. */
export function addErrorKey(code: string): 'collectGone' | 'price' | 'conflict' | 'market' | 'generic' {
  if (code === 'not_available_for_collection') return 'collectGone';
  if (code === 'price_unavailable' || code === 'validation_failed') return 'price';
  if (code === 'conflict') return 'conflict';
  if (code === 'collect_not_available_in_market') return 'market';
  return 'generic';
}

/**
 * Quantity stepper and the add button (workstream H, 3.8). The button follows `addButtonState`: a missing choice, no
 * price, no store, no stock for the active fulfilment, then Reserve, Add to bag or Subscribe with the line total. The
 * stepper clamps to the stock of the active fulfilment and to the inventory cart limits. Success toasts and updates the
 * header count (through `useAddToCart`); nothing opens or navigates (Q-H-12).
 */
export default function AddToBag() {
  const t = useTranslations('pdp');
  const tShell = useTranslations('shell.toast');
  const locale = useLocale();
  const toast = useToast();
  const { open } = useCollectionStore();
  const { data, variant, preview, fulfilment, quantity, setQuantity, minQty, maxQty, missing, policies, policyId, store } = usePdp();
  const { add, isAdding, error } = useAddToCart();
  const router = useRouter();
  // The store ran out between the page load and the add: re-read the stock so the block and the options tell the truth.
  useEffect(() => {
    if (error === 'not_available_for_collection') router.refresh();
  }, [error, router]);

  const chosenPolicy = policies.find((p) => p.policy.id === policyId) ?? policies[0];
  const choice = missing && t.has(`selector.choice.${missing.attr}`) ? t(`selector.choice.${missing.attr}`) : (missing?.attr ?? '');
  const state = addButtonState({
    ...(missing ? { missingChoice: choice } : {}),
    variant,
    fulfilment,
    ...(store ? { storeChannelId: store.id } : {}),
    quantity,
    inventoryFailed: data.inventoryFailed,
    noPolicy: fulfilment === 'subscribe' && !chosenPolicy,
  });

  let total: Money | null = null;
  if (state.showTotal && variant?.price) {
    total = fulfilment === 'subscribe' && chosenPolicy ? recurringTotal(chosenPolicy.price.value, quantity) : lineTotal(variant.price, quantity);
  }
  const base = t(`add.${state.key}`, { choice });
  const label = total ? t('add.withTotal', { label: base, total: formatMoney(total.centAmount, total.currencyCode, locale) }) : base;

  const onClick = async () => {
    if (state.key === 'chooseStore') {
      open({ sku: preview.sku });
      return;
    }
    if (!variant || state.disabled) return;
    const cart = await add({
      sku: variant.sku,
      quantity,
      fulfilment,
      ...(fulfilment === 'collect' && store ? { storeKey: store.key } : {}),
      ...(fulfilment === 'subscribe' && chosenPolicy ? { recurrencePolicyKey: chosenPolicy.policy.key } : {}),
    });
    if (cart) toast.show(fulfilment === 'collect' ? t('toast.reserved') : tShell('added'));
  };

  // A disabled button already says why (unavailable for collection, out of stock); "Only 1 available" under it would contradict it.
  const limited = maxQty < PDP_MAX_QUANTITY && quantity >= maxQty && !state.disabled;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <Stepper value={quantity} min={minQty} max={maxQty} onChange={setQuantity} label={t('qty.label')} disabled={state.disabled && state.key === 'select'} />
        <Button
          size="lg"
          block
          variant="accent"
          loading={isAdding}
          disabled={state.disabled}
          onClick={onClick}
          data-testid="add-to-bag"
          data-state={state.key}
          className="min-w-[200px] flex-1"
        >
          {label}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      {limited ? <p className="m-0 text-[12.5px] text-ink-3">{t('qty.limit', { n: maxQty })}</p> : null}
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-medium text-danger-text">
          {t(`error.${addErrorKey(error)}`)}
        </p>
      ) : null}
    </div>
  );
}
