'use client';

import { useLocale, useTranslations } from 'next-intl';
import AvailabilityDot from '@/components/ui/AvailabilityDot';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { marketForLocale } from '@/lib/utils';
import type { AvailabilityState } from '@/lib/types';

/**
 * Availability at the chosen collection store: dot and "In stock at {store}" / "Low stock at ..." / "Not available at ...".
 * No store chosen: a "Choose a store" button that opens the picker. Nothing at all in a market without collection (Canada).
 * The card stays openable and shippable when the store is out. Indexed availability lags inventory; H and I re-read stock.
 */
export default function AvailabilityLine({ state }: { state: AvailabilityState | null }) {
  const t = useTranslations('card.availability');
  const market = marketForLocale(useLocale());
  const { store, open } = useCollectionStore();
  if (!market.collection) return null;
  if (!store) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="relative z-20 mt-1 border-0 bg-transparent p-0 text-left text-[12.5px] font-medium text-accent underline underline-offset-2"
      >
        {t('choose')}
      </button>
    );
  }
  if (!state) return null;
  return (
    <p className="m-0 mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-2" data-state={state}>
      <AvailabilityDot state={state} />
      {t(state, { store: store.name })}
    </p>
  );
}
