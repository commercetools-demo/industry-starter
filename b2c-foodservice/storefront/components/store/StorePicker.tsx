'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import StoreRow from '@/components/store/StoreRow';
import StoreSearch from '@/components/store/StoreSearch';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/context/toast';
import { useAvailability } from '@/hooks/useAvailability';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import type { LatLng } from '@/lib/geo';
import { searchStores } from '@/lib/store-search';
import { marketForLocale } from '@/lib/utils';

/**
 * The store picker modal. Mount once (the header does). Open it with `useCollectionStore().open()` from the header or
 * `open({ sku })` from a product, which adds an availability line per store from one `/api/availability` call.
 */
export default function StorePicker() {
  const t = useTranslations('store.picker');
  const market = marketForLocale(useLocale());
  const { stores, store, isOpen, close, sku, select, error, isLoading, retry, setPreferShip } = useCollectionStore();
  const toast = useToast();
  // Header opening makes no availability request: the key is null.
  const availability = useAvailability(isOpen ? sku : null, market.country);

  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectFailed, setSelectFailed] = useState(false);
  const [now] = useState(() => new Date());
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The dialog hook focuses the first control (close); the search field is the better start.
    if (isOpen) queueMicrotask(() => search.current?.focus());
  }, [isOpen]);

  const result = searchStores(stores, query, position);

  const useLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationOff(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocationOff(false);
        setLocating(false);
      },
      () => {
        setLocationOff(true);
        setLocating(false);
      },
    );
  };

  const choose = async (key: string) => {
    setSelectFailed(false);
    const ok = await select(key);
    if (!ok) {
      setSelectFailed(true);
      return;
    }
    close();
    toast.show(t('selected', { store: stores.find((s) => s.key === key)?.name ?? '' }));
  };

  const shipInstead = () => {
    close();
    if (sku) setPreferShip(true);
  };

  if (!market.collection) return null;

  const availabilityFor = (key: string) => {
    if (!sku || availability.error) return undefined;
    if (availability.isLoading || !availability.data) return { loading: true, state: null };
    return { loading: false, state: availability.data.stores.find((s) => s.storeKey === key)?.state ?? 'out' };
  };

  return (
    <Modal open={isOpen} onClose={close} title={t('title')}>
      <p className="m-0 mb-4 text-[14px] text-ink-2">{t('intro')}</p>
      <StoreSearch
        ref={search}
        onQuery={setQuery}
        onUseLocation={useLocation}
        locationOff={locationOff}
        locating={locating}
      />
      <p className="sr-only" aria-live="polite">
        {t('count', { count: result.rows.length })}
      </p>

      {error && stores.length === 0 ? (
        <div role="alert" className="rounded-card border border-line-2 p-4">
          <p className="m-0 mb-3 text-[14px]">{t('error')}</p>
          <Button type="button" variant="ghost" onClick={() => retry()}>
            {t('retry')}
          </Button>
        </div>
      ) : isLoading && stores.length === 0 ? (
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[84px] animate-pulse rounded-card bg-canvas-2" />
          ))}
        </div>
      ) : result.noMatch ? (
        <div className="rounded-card border border-line-2 p-5 text-center">
          <p className="m-0 mb-3 text-[14px]">{t('noMatch', { query: query.trim() || t('yourLocation') })}</p>
          <Button type="button" variant="ghost" onClick={shipInstead}>
            {t('shipInstead')}
          </Button>
        </div>
      ) : (
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="sr-only">{t('title')}</legend>
          {result.rows.map((row, i) => (
            <StoreRow
              key={row.store.key}
              store={row.store}
              selected={store?.key === row.store.key}
              onSelect={choose}
              km={result.hasDistance ? row.km : null}
              nearest={result.hasDistance && i === 0}
              availability={availabilityFor(row.store.key)}
              now={now}
            />
          ))}
        </fieldset>
      )}
      {selectFailed ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger-text">
          {t('selectError')}
        </p>
      ) : null}
    </Modal>
  );
}
