'use client';

import { useLocale, useTranslations } from 'next-intl';
import AvailabilityDot from '@/components/ui/AvailabilityDot';
import { AVAILABILITY_LABEL_KEY } from '@/lib/availability';
import { formatDistance } from '@/lib/geo';
import { todayHours } from '@/lib/hours';
import { cn } from '@/lib/cn';
import type { AvailabilityState, Store } from '@/lib/types';

interface StoreRowProps {
  store: Store;
  selected: boolean;
  onSelect: (key: string) => void;
  /** Kilometres from the shopper, only when a real position exists. */
  km: number | null;
  nearest: boolean;
  /** Present when the picker was opened from a product: undefined while loading, otherwise the state for this store. */
  availability?: { loading: boolean; state: AvailabilityState | null };
  now: Date;
}

/** One store: a real radio inside a label, so the whole row is keyboard and pointer operable. */
export default function StoreRow({ store, selected, onSelect, km, nearest, availability, now }: StoreRowProps) {
  const t = useTranslations('store.picker');
  const locale = useLocale();
  const hours = todayHours(store, now, store.timeZone);

  return (
    <label
      className={cn(
        'transition-state flex cursor-pointer items-start gap-3.5 rounded-card border bg-surface p-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
        selected ? 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-line-2 hover:border-ink',
      )}
    >
      <input
        type="radio"
        name="store"
        value={store.key}
        checked={selected}
        onChange={() => onSelect(store.key)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2',
          selected ? 'border-accent' : 'border-line-2',
        )}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-pill bg-accent" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[15px] font-semibold">{store.name}</span>
          {nearest ? (
            <span className="rounded-pill bg-canvas-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              {t('nearest')}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[13.5px] text-ink-2">
          {store.addressLine}, {store.city}
          {km !== null ? ` · ${formatDistance(km, locale)}` : ''}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-3">
          {hours ? t('openToday', { open: hours.open, close: hours.close }) : t('closedToday')}
        </span>
        {availability ? (
          <span className="mt-2 flex items-center gap-2 text-[13px]">
            {availability.loading || !availability.state ? (
              <span role="status" aria-label={t('loading')} className="block h-3 w-32 animate-pulse rounded-pill bg-canvas-2" />
            ) : (
              <>
                <AvailabilityDot state={availability.state} />
                <span
                  className={cn(
                    availability.state === 'in' && 'text-teal-text',
                    availability.state === 'low' && 'text-ink',
                    availability.state === 'out' && 'text-ink-3',
                  )}
                >
                  {t(AVAILABILITY_LABEL_KEY[availability.state])}
                </span>
              </>
            )}
          </span>
        ) : null}
      </span>
    </label>
  );
}
