'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useShellUi } from '@/context/shell-ui-context';
import { useToast } from '@/context/toast';
import Button from '@/components/ui/Button';
import Stepper from '@/components/ui/Stepper';
import { useAddPresetBundle } from '@/hooks/useAddPresetBundle';
import { BUNDLE_MAX_QUANTITY } from '@/lib/preset-bundle/selection';
import { formatMoney } from '@/lib/utils';

/** The message key for a bundle add failure (the server's domain code). */
export function bundleErrorKey(code: string): 'unavailable' | 'choose' | 'stock' | 'collect' | 'generic' {
  if (code === 'bundle_preset_unavailable') return 'unavailable';
  if (code === 'bundle_requires_preset' || code === 'bundle_not_subscribable') return 'choose';
  if (code === 'quantity_exceeds_stock') return 'stock';
  if (code === 'not_available_for_collection') return 'collect';
  return 'generic';
}

/**
 * The quantity and the add button of a bundle. The browser sends { sku, preset, quantity, machineSku, fulfilment }: never a
 * price. The total label is the unit price × quantity from the view; the server computes the real price (workstream V, D2).
 */
export default function BundleAddToBag({
  sku, preset, machineSku, unitCents, currency,
}: { sku: string; preset: number; machineSku: string; unitCents: number; currency: string }) {
  const t = useTranslations('presetBundle');
  const locale = useLocale();
  const ui = useShellUi();
  const toast = useToast();
  const { add, isAdding, error } = useAddPresetBundle();
  const [quantity, setQuantity] = useState(1);

  const onAdd = async () => {
    const cart = await add({ sku, preset, quantity, machineSku, fulfilment: 'delivery' });
    if (cart) {
      ui.openCart();
      toast.show(t('added'));
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Stepper value={quantity} min={1} max={BUNDLE_MAX_QUANTITY} onChange={setQuantity} label={t('quantity')} disabled={isAdding} />
        <Button variant="accent" size="lg" block className="flex-1" loading={isAdding} onClick={() => void onAdd()}>
          {t('addToBag', { total: formatMoney(unitCents * quantity, currency, locale) })}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger-text">
          {t(`error.${bundleErrorKey(error)}`)}
        </p>
      ) : null}
    </div>
  );
}
