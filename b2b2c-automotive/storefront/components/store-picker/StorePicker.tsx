// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { BranchList } from '@/components/store-picker/BranchList';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useGeocode, GEOCODE_MIN_CHARS } from '@/hooks/useGeocode';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSelectBranch } from '@/hooks/useSelectBranch';
import { useRouter } from '@/i18n/routing';
import { arrangeBranches } from '@/lib/store/branch-search';
import type { BranchesResponse } from '@/lib/types';

// Leaflet touches `window` when it loads, so the map is a client-only chunk that loads when the picker opens.
const BranchMap = dynamic(() => import('@/components/store-picker/BranchMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-64 w-full bg-surface-subtle" aria-hidden="true" />,
});

interface Props {
  open: boolean;
  onClose: () => void;
  data: BranchesResponse;
}

/** Modal "Choose your store": the list is the primary control, the map an enhancement; both stay in sync through `focusedKey`. */
export function StorePicker({ open, onClose, data }: Props) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-h-[85vh]">
      <PickerBody titleId={titleId} data={data} onClose={onClose} />
    </Modal>
  );
}

function PickerBody({ titleId, data, onClose }: { titleId: string; data: BranchesResponse; onClose: () => void }) {
  const t = useTranslations('storePicker');
  const locale = useLocale();
  const router = useRouter();
  const select = useSelectBranch();
  const [query, setQuery] = useState('');
  const [chosenFocus, setFocusedKey] = useState<string | null>(data.selectedKey || null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const geo = useGeolocation();
  const geocode = useGeocode(query, locale);

  const first = geocode.results[0];
  const geocodedPoint = useMemo(() => (first ? { lat: first.lat, lng: first.lng } : null), [first]);
  const origin = geocodedPoint ?? geo.position;
  const rows = useMemo(() => arrangeBranches(data.branches, { query, origin, geocoded: geocodedPoint !== null }), [data.branches, query, origin, geocodedPoint]);
  // Keep the focus where the shopper put it while that branch is listed; otherwise the first row.
  const focusedKey = rows.some((r) => r.branch.key === chosenFocus) ? chosenFocus : (rows[0]?.branch.key ?? null);

  async function choose(branchKey: string) {
    setBusy(true);
    setFailed(false);
    try {
      await select(branchKey);
      onClose();
      // Server-rendered stock, pickup text and prices are derived from the session: re-read the page.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <h2 id={titleId} className="font-display text-xl font-bold text-text">
          {t('title')}
        </h2>
        <Button variant="link" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-1 md:overflow-visible">
        <div className="flex max-h-[40vh] min-h-0 flex-col gap-3 overflow-y-auto p-4 md:max-h-none">
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
            {failed ? t('chooseFailed') : status}
          </p>
          <BranchList rows={rows} focusedKey={focusedKey} currentKey={data.selectedKey} busy={busy} onFocus={setFocusedKey} onChoose={choose} />
        </div>
        <div className="min-h-64 border-t border-border md:border-l md:border-t-0" aria-label={t('mapLabel')} role="region">
          <BranchMap branches={data.branches} focusedKey={focusedKey} onFocus={setFocusedKey} center={origin} />
        </div>
      </div>
    </div>
  );
}
