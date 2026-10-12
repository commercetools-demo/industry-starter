'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Theme preview with real storefront pages (workstream U-06, decision 12): a page switcher (Home, Listing, Product, Cart,
// Checkout), a device toggle (Desktop 1280 wide scaled to the card, Phone 375 wide) and Refresh. The frame shows the SAVED theme; it
// reloads after a successful save (`reloadKey` changes) and on Refresh. A page the storefront does not serve yet is disabled with
// "Storefront page not available yet".
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { buttonSecondary, errorNote, hintClass, sectionTitle } from '@/components/portal/kit';
import { usePreviewPages } from '@/hooks/storeApi';
import { PREVIEW_WIDTHS, type PreviewPageId } from '@/lib/portal/storefront-urls';

type Device = 'desktop' | 'phone';
const FRAME_HEIGHT = { desktop: 800, phone: 667 } as const;

export function StorefrontPreview({ reloadKey }: { reloadKey: number }) {
  const t = useTranslations('store.theme.preview');
  const locale = useLocale();
  const { data, error, isLoading, mutate } = usePreviewPages(locale);
  const [page, setPage] = useState<PreviewPageId>('home');
  const [device, setDevice] = useState<Device>('desktop');
  const [manualReload, setManualReload] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = data?.pages.find((p) => p.id === page);
  const width = PREVIEW_WIDTHS[device];
  const height = FRAME_HEIGHT[device];
  const scale = available > 0 ? Math.min(1, available / width) : 1;

  return (
    <div className="flex flex-col gap-300">
      <h2 className={sectionTitle}>{t('title')}</h2>
      <div className="flex flex-wrap items-center gap-200">
        <div role="tablist" aria-label={t('pages')} className="flex flex-wrap gap-100 rounded-300 bg-bg-surface-subdued p-100">
          {(data?.pages ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={page === p.id}
              disabled={!p.available}
              title={p.available ? undefined : t('unavailable')}
              onClick={() => setPage(p.id)}
              className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active disabled:cursor-not-allowed disabled:text-text-disabled ${
                page === p.id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'
              }`}
            >
              {t(`pageNames.${p.id}`)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('device')} className="flex gap-100 rounded-300 bg-bg-surface-subdued p-100">
          {(['desktop', 'phone'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${
                device === d ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'
              }`}
            >
              {t(d)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setManualReload((n) => n + 1);
            void mutate();
          }}
          className={buttonSecondary}
        >
          {t('refresh')}
        </button>
      </div>
      {error ? <p role="alert" className={errorNote}>{t('loadFailed')}</p> : null}
      {isLoading && !data ? <p role="status" className={hintClass}>{t('loading')}</p> : null}
      {data && data.pages.some((p) => !p.available) ? <p className={hintClass}>{t('unavailableNote')}</p> : null}
      <p className={hintClass}>{t('savedOnly')}</p>
      <div ref={holder} className="w-full overflow-hidden rounded-300 border border-border bg-bg-surface-subdued" style={{ height: height * scale }}>
        {current?.available && current.url ? (
          <iframe
            key={`${page}-${device}-${reloadKey}-${manualReload}`}
            src={current.url}
            title={t('frameTitle', { page: t(`pageNames.${page}`) })}
            referrerPolicy="no-referrer"
            className="block origin-top-left border-0 bg-gray-1"
            style={{ width, height, transform: `scale(${scale})`, marginInline: device === 'phone' ? 'auto' : undefined }}
          />
        ) : (
          <p className="p-600 text-body-2 font-semibold text-text-subdued">{data ? t('unavailable') : ''}</p>
        )}
      </div>
    </div>
  );
}
