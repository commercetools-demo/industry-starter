'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePdp } from '@/components/pdp/pdp-state';
import { useNow } from '@/components/pdp/use-now';
import AvailabilityDot from '@/components/ui/AvailabilityDot';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { availabilityState } from '@/lib/availability';
import { collectionReadiness } from '@/lib/product/readiness';
import { LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type { Weekday } from '@/lib/types';

const DAY_INDEX: Record<Weekday, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** "7:30 AM" for an `HH:mm` store time, formatted for the display locale (no time zone shift: it is a wall clock time). */
function clock(hhmm: string, locale: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
}

/**
 * Collect block (workstream H, 3.8): status of the resolved variant at the chosen store (dot and text, never colour
 * alone), the address, when it is ready (only while the store is open and the preparation ends before closing), and
 * "Change". With no store it asks the shopper to choose one. Stock is read from the inventory, not the cards.
 */
export default function CollectBlock() {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const { data, preview, store, refreshing } = usePdp();
  const { open } = useCollectionStore();
  const now = useNow();

  if (!store) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5" data-testid="collect-block">
        <p className="m-0 text-[14px] text-ink-2">{t('collect.chooseStore')}</p>
        <Button size="md" onClick={() => open({ sku: preview.sku })}>
          {t('collect.chooseButton')}
        </Button>
      </div>
    );
  }
  if (refreshing) {
    return (
      <div className="rounded-card border border-line bg-surface px-4 py-3.5" data-testid="collect-block" aria-busy="true">
        <p className="m-0 text-[13px] text-ink-3">{t('collect.refreshing')}</p>
        <div className="mt-2 h-4 w-2/3 rounded-field bg-canvas-2" />
      </div>
    );
  }

  const quantity = preview.stock.stores[store.id] ?? 0;
  const state = data.inventoryFailed ? null : availabilityState(quantity, LOW_STOCK_THRESHOLD);
  const readiness = state && state !== 'out' && now ? collectionReadiness(store, now) : null;
  const address = [store.addressLine, store.city].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5" data-testid="collect-block" data-state={state ?? 'unknown'}>
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 flex items-center gap-2 text-[14px] font-medium text-ink">
          {state ? <AvailabilityDot state={state} /> : null}
          <span className={state === 'in' ? 'text-teal-text' : state === 'low' ? 'text-ink' : 'text-ink-2'}>
            {state === null ? t('error.stockUnknown') : t(`collect.${state}`, { store: store.name })}
          </span>
        </p>
        <button
          type="button"
          onClick={() => open({ sku: preview.sku })}
          className="border-0 bg-transparent p-0 text-[13px] font-medium text-accent underline underline-offset-2"
        >
          {t('collect.change')}
        </button>
      </div>
      {address ? <p className="m-0 text-[13px] text-ink-3">{address}</p> : null}
      {readiness?.kind === 'ready' ? (
        <p className="m-0 flex items-center gap-1.5 text-[13px] font-medium text-teal-text">
          <Icon name="clock" size={15} />
          {t('collect.ready', { n: readiness.minutes })}
        </p>
      ) : readiness?.kind === 'later' ? (
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-ink-2">
          <Icon name="clock" size={15} />
          {t('collect.readyOn', {
            day:
              readiness.dayOffset === 0
                ? t('collect.day.today')
                : readiness.dayOffset === 1
                  ? t('collect.day.tomorrow')
                  : new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + DAY_INDEX[readiness.weekday]))),
            time: clock(readiness.time, locale),
          })}
        </p>
      ) : null}
    </div>
  );
}
