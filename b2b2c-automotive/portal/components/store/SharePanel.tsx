'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store & channels, tab Share (workstream U-05, decision 9): per channel an attributed storefront link (`?ch=`) with a QR code and
// Copy link, and the link-in-bio entry that needs a published `/link-in-bio` page. The QR code is an SVG shown through an <img> data
// URL (never injected as markup).
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { buttonSmall, cardClass, hintClass, infoNote, inputClass, sectionTitle } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { useLinkInBioStatus } from '@/hooks/storeApi';
import { CHANNEL_IDS, linkInBioLink, shareLink, type ChannelId } from '@/lib/portal/share-links';

/** `data:` URL of the QR code of a link. Null until it is drawn. */
export function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: 'svg', margin: 1 })
      .then((svg) => {
        if (live) setDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (live) setDataUrl(null);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return dataUrl;
}

function LinkLine({ label, url, copyLabel }: { label: string; url: string; copyLabel: string }) {
  const t = useTranslations('store.share');
  const { toast } = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'));
    } catch {
      toast(t('copyFailed'));
    }
  }
  return (
    <div className="flex flex-col gap-100">
      <span className="text-body-2 font-semibold text-text">{label}</span>
      <div className="flex items-center gap-200">
        <input readOnly value={url} aria-label={label} className={inputClass} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy} className={`${buttonSmall} flex-none`} aria-label={copyLabel}>
          {t('copy')}
        </button>
      </div>
    </div>
  );
}

function ChannelShare({ origin, locale, storeKey, channel, bioPublished }: { origin: string; locale: string; storeKey: string; channel: ChannelId; bioPublished: boolean }) {
  const t = useTranslations('store.share');
  const tNames = useTranslations('store.channels.names');
  const link = shareLink(origin, locale, storeKey, channel);
  const bio = linkInBioLink(origin, locale, storeKey, channel);
  const qr = useQrDataUrl(link);
  const name = tNames(channel);
  return (
    <li className={`${cardClass} flex flex-col gap-300`}>
      <h3 className="text-title-2 font-semibold text-text">{name}</h3>
      <div className="flex flex-wrap items-start gap-400">
        <div className="flex size-2400 flex-none items-center justify-center overflow-hidden rounded-300 border border-border bg-gray-1">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not an optimisable asset
            <img src={qr} alt={t('qrAlt', { name })} className="size-full" />
          ) : (
            <span className={hintClass}>{t('qrLoading')}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-300">
          <LinkLine label={t('storeLink')} url={link} copyLabel={t('copyFor', { name })} />
          <LinkLine label={t('bioLink')} url={bio} copyLabel={t('copyBioFor', { name })} />
          {bioPublished ? null : <p className={infoNote}>{t('bioNotice')}</p>}
        </div>
      </div>
    </li>
  );
}

export function SharePanel({ origin }: { origin: string }) {
  const t = useTranslations('store.share');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { data } = useLinkInBioStatus();
  return (
    <section className="flex flex-col gap-400" aria-labelledby="store-share">
      <div>
        <h2 id="store-share" className={sectionTitle}>
          {t('title')}
        </h2>
        <p className={hintClass}>{t('subtitle')}</p>
      </div>
      <ul className="grid gap-400 xl:grid-cols-2">
        {CHANNEL_IDS.map((channel) => (
          <ChannelShare key={channel} origin={origin} locale={locale} storeKey={storeKey} channel={channel} bioPublished={data?.published === true} />
        ))}
      </ul>
    </section>
  );
}
