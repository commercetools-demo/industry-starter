// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { buttonClass, Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useGeocode, GEOCODE_MIN_CHARS } from '@/hooks/useGeocode';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useResellers } from '@/hooks/useResellers';
import { Link } from '@/i18n/routing';
import { arrangeResellers, resellerPath, type ResellerRow } from '@/lib/malva/reseller-search';
import { formatDistance } from '@/lib/store/format';

// Leaflet touches `window` when it loads, so the map is a client-only chunk (the store picker's map, reused).
const BranchMap = dynamic(() => import('@/components/store-picker/BranchMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-64 w-full bg-surface-subtle" aria-hidden="true" />,
});

export interface ResellerFinderProps {
  /** `inline` sits in the page (home); `drawer` fills the drawer and scrolls inside it. */
  mode: 'inline' | 'drawer';
  /** The product the shopper chose a reseller for: rows then link to `/{store}/p/{slug}`. */
  productSlug?: string;
  locale: string;
}

/**
 * The cross-reseller locator. Search by postal code prefix or city (no accents or case), "Use my location" on a click only,
 * the store picker's map and distance helpers, and a "Shop at this reseller" link per row. The link is built from the store key
 * and the product slug only, both validated first; a row whose key or slug is not valid has no link.
 */
export function ResellerFinder({ mode, productSlug, locale }: ResellerFinderProps) {
  const t = useTranslations('malvaFinder');
  const { resellers, isLoading, error, retry } = useResellers(locale);
  const [query, setQuery] = useState('');
  const [chosenFocus, setFocusedKey] = useState<string | null>(null);
  const geo = useGeolocation();
  const geocode = useGeocode(query, locale);

  const first = geocode.results[0];
  const geocodedPoint = useMemo(() => (first ? { lat: first.lat, lng: first.lng } : null), [first]);
  const origin = geocodedPoint ?? geo.position;
  const rows = useMemo(() => arrangeResellers(resellers ?? [], { query, origin, geocoded: geocodedPoint !== null }), [resellers, query, origin, geocodedPoint]);
  const focusedKey = rows.some((r) => r.reseller.key === chosenFocus) ? chosenFocus : (rows[0]?.reseller.key ?? null);
  const places = useMemo(() => rows.map((r) => ({ key: r.reseller.key, name: r.reseller.name, geo: r.reseller.lat !== undefined && r.reseller.lng !== undefined ? { lat: r.reseller.lat, lng: r.reseller.lng } : undefined })), [rows]);
  const showMap = places.some((p) => p.geo);

  const typed = query.trim().length >= GEOCODE_MIN_CHARS;
  const status =
    geo.status === 'denied'
      ? t('locationDenied')
      : geo.status === 'unavailable'
        ? t('locationUnavailable')
        : geo.status === 'pending'
          ? t('locationPending')
          : typed && geocode.status === 'loading'
            ? t('searching')
            : typed && geocode.status === 'unavailable'
              ? t('geocodeUnavailable')
              : '';

  const layout = mode === 'drawer' ? 'grid gap-4' : 'grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]';
  return (
    <div className={layout} data-mode={mode}>
      <div className="flex min-h-0 flex-col gap-3">
        <Field
          label={t('searchLabel')}
          type="search"
          placeholder={t('searchPlaceholder')}
          value={query}
          autoComplete="postal-code"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              geocode.submit();
            }
          }}
        />
        <Button variant="secondary" onClick={geo.request} disabled={geo.status === 'pending'}>
          {t('useLocation')}
        </Button>
        <p role="status" aria-live="polite" className="min-h-5 font-ui text-xs text-text-muted">
          {status}
        </p>
        <ResellerList rows={rows} focusedKey={focusedKey} onFocus={setFocusedKey} productSlug={productSlug} locale={locale} loading={isLoading} failed={error} onRetry={retry} />
      </div>
      {showMap ? (
        <div className="h-64 min-h-64 overflow-hidden rounded-md border border-border md:h-auto" role="region" aria-label={t('mapLabel')}>
          <BranchMap branches={places} focusedKey={focusedKey} onFocus={setFocusedKey} center={origin} />
        </div>
      ) : null}
    </div>
  );
}

interface ListProps {
  rows: ResellerRow[];
  focusedKey: string | null;
  onFocus: (key: string) => void;
  productSlug?: string;
  locale: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

function ResellerList({ rows, focusedKey, onFocus, productSlug, locale, loading, failed, onRetry }: ListProps) {
  const t = useTranslations('malvaFinder');
  if (loading) {
    return (
      <p role="status" className="font-ui text-sm text-text-muted">
        {t('loading')}
      </p>
    );
  }
  if (failed) {
    return (
      <div role="alert" className="grid justify-items-start gap-2">
        <p className="m-0 font-ui text-sm text-text">{t('error')}</p>
        <Button variant="secondary" onClick={onRetry}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p role="status" className="m-0 rounded-md border border-dashed border-border-strong bg-surface p-4 font-ui text-sm text-text-muted">
        {t('empty')}
      </p>
    );
  }
  return (
    <ul aria-label={t('resultsLabel')} className="m-0 grid list-none gap-2 p-0">
      {rows.map(({ reseller, distanceKm }) => {
        const href = resellerPath(reseller.key, productSlug);
        const focused = reseller.key === focusedKey;
        const cities = [...new Set(reseller.branches.map((b) => b.city).filter(Boolean))];
        return (
          <li key={reseller.key} className={`grid gap-1 rounded-md border bg-surface p-3 ${focused ? 'border-border-brand' : 'border-border'}`} onClick={() => onFocus(reseller.key)}>
            <div className="flex items-start justify-between gap-3">
              <span className="font-display text-sm font-medium text-text">{reseller.name}</span>
              {distanceKm !== undefined ? <span className="shrink-0 font-ui text-xs text-text-muted">{formatDistance(distanceKm, locale)}</span> : null}
            </div>
            <span className="font-ui text-xs text-text-muted">{[reseller.address, [reseller.postalCode, reseller.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            {reseller.branches.length > 0 ? (
              <span className="font-ui text-xs text-text-muted">
                {t('branches', { count: reseller.branches.length })}
                {cities.length > 0 ? ` · ${cities.join(', ')}` : ''}
              </span>
            ) : null}
            {href ? (
              <Link href={href} locale={locale as never} aria-label={t('shopAria', { name: reseller.name })} className={buttonClass('primary', 'mt-2 w-full')}>
                {t('shop')}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
