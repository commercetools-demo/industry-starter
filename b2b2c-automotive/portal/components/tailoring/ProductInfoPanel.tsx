/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { Chip } from '@/components/catalog/Chip';
import { ConfirmDialog } from '@/components/catalog/ConfirmDialog';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, infoNote, inputClass, labelClass, textareaClass } from '@/components/catalog/ui';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { tailoringApi, useRefreshCatalog, useTailoringDetail, useTailoringList } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import type { ImageRef, TailoringDetail } from '@/lib/catalog/types';
import { getLocalizedString } from '@/lib/utils';
import { ImagePanel } from './ImagePanel';

type Texts = Record<string, string>;

/** The tailored text of a locale, or '' when it is the master text (untailored locales are stored filled with the master text). */
const tailoredOnly = (tailored: Texts, master: Texts, languages: string[]): Texts => Object.fromEntries(languages.map((l) => [l, tailored[l] && tailored[l] !== master[l] ? tailored[l] : '']));

function Editor({ detail, name, canEdit }: { detail: TailoringDetail; name: string; canEdit: boolean }) {
  const t = useTranslations('catalog.productInfo');
  const tp = useTranslations('permissions');
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const [lang, setLang] = useState(detail.languages[0] ?? 'de-DE');
  const [nameText, setNameText] = useState<Texts>(() => tailoredOnly(detail.tailored.name, detail.master.name, detail.languages));
  const [descText, setDescText] = useState<Texts>(() => tailoredOnly(detail.tailored.description, detail.master.description, detail.languages));
  const [images, setImages] = useState<ImageRef[]>(detail.tailored.images);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [altErrors, setAltErrors] = useState(false);
  const [resetting, setResetting] = useState(false);

  const nonEmpty = (texts: Texts) => Object.fromEntries(Object.entries(texts).filter(([, v]) => v.trim()));

  async function save() {
    setMessage('');
    setProblem('');
    // WCAG 1.1.1: shoppers' screen readers need the alt text, so an image without one is not published.
    const missing = images.findIndex((i) => !i.label?.trim());
    if (missing >= 0) {
      setAltErrors(true);
      setProblem(t('images.altSummary'));
      document.querySelectorAll<HTMLElement>('[data-alt-input]')[missing]?.focus();
      return;
    }
    setBusy(true);
    const result = await tailoringApi.save(storeKey, detail.productId, {
      name: nonEmpty(nameText),
      description: nonEmpty(descText),
      images: images.map((i) => ({ url: i.url, ...(i.label ? { label: i.label } : {}) })),
    });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.status === 403 ? tp('insufficient') : (result.error ?? t('errors.generic')));
      return;
    }
    setMessage(t('published'));
    toast(t('published'));
    await refresh();
  }

  async function reset() {
    setBusy(true);
    const result = await tailoringApi.reset(storeKey, detail.productId);
    setBusy(false);
    setResetting(false);
    if (!result.ok) return setProblem(result.status === 403 ? tp('insufficient') : t('errors.generic'));
    setNameText(tailoredOnly({}, {}, detail.languages));
    setDescText(tailoredOnly({}, {}, detail.languages));
    setImages([]);
    setMessage(t('resetDone'));
    await refresh();
  }

  const masterName = detail.master.name[lang] ?? '';
  const masterDesc = detail.master.description[lang] ?? '';

  return (
    <section className={`${cardClass} flex flex-col gap-500`} aria-labelledby="editor-title">
      <div className="flex flex-wrap items-start justify-between gap-300">
        <div>
          <h2 id="editor-title" className="text-title-1 font-semibold text-text">
            {t('yourPresentation')}
          </h2>
          <p className={hintClass}>
            {name} · <span className="font-mono">{detail.sku}</span>
          </p>
        </div>
        <div role="group" aria-label={t('language')} className="flex gap-100 rounded-300 bg-bg-surface-subdued p-100">
          {detail.languages.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`h-1000 rounded-200 px-300 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${lang === l ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
            >
              {l}
              {detail.tailoredLocales.includes(l) ? ` · ${t('tailoredShort')}` : ''}
            </button>
          ))}
        </div>
      </div>

      {!canEdit ? (
        <p role="note" className={infoNote}>
          {tp('insufficient')}
        </p>
      ) : null}

      <div className="flex flex-col gap-150">
        <label htmlFor="tailor-name" className={labelClass}>
          {t('name')} ({lang})
        </label>
        <input id="tailor-name" value={nameText[lang] ?? ''} onChange={(e) => setNameText({ ...nameText, [lang]: e.target.value })} placeholder={masterName} disabled={!canEdit} className={inputClass} />
        <p className={hintClass}>{t('masterValue', { value: masterName || '—' })}</p>
      </div>

      <div className="flex flex-col gap-150">
        <label htmlFor="tailor-desc" className={labelClass}>
          {t('description')} ({lang})
        </label>
        <textarea id="tailor-desc" value={descText[lang] ?? ''} onChange={(e) => setDescText({ ...descText, [lang]: e.target.value })} placeholder={masterDesc} disabled={!canEdit} className={textareaClass} />
        <p className={hintClass}>{t('masterValue', { value: masterDesc || '—' })}</p>
      </div>

      <div className="flex flex-col gap-200">
        <h3 className="text-body-2 font-bold text-text">{t('imagesTitle')}</h3>
        <ImagePanel storeKey={storeKey} productId={detail.productId} master={detail.master.images} value={images} onChange={setImages} canEdit={canEdit} showAltErrors={altErrors} />
      </div>

      <aside aria-labelledby="master-title" className="flex flex-col gap-200 rounded-300 bg-bg-surface-subdued p-400">
        <h3 id="master-title" className="text-body-2 font-bold text-text">
          {t('masterRecord')}
        </h3>
        <p data-testid="master-note" className="text-body-2 text-text">{t('masterNote')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-400 gap-y-100 text-body-2">
          <dt className="font-semibold text-text-subdued">{t('locked.sku')}</dt>
          <dd className="font-mono text-text">{detail.sku}</dd>
          <dt className="font-semibold text-text-subdued">{t('locked.fitment')}</dt>
          <dd className="text-text-subdued">{t('locked.value')}</dd>
          <dt className="font-semibold text-text-subdued">{t('locked.specs')}</dt>
          <dd className="text-text-subdued">{t('locked.value')}</dd>
        </dl>
      </aside>

      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {message ? (
        <p role="status" data-testid="tailoring-message" className="text-body-2 font-semibold text-text-success">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-300">
        <button type="button" className={buttonSecondary} disabled={!canEdit || busy} onClick={() => setResetting(true)}>
          {t('reset')}
        </button>
        <button type="button" className={buttonPrimary} disabled={!canEdit || busy} title={!canEdit ? tp('insufficient') : undefined} onClick={save}>
          {t('save')}
        </button>
      </div>

      <ConfirmDialog open={resetting} title={t('resetDialog.title')} confirmLabel={t('resetDialog.confirm')} cancelLabel={t('resetDialog.cancel')} busy={busy} onConfirm={reset} onCancel={() => setResetting(false)}>
        <p>{t('resetDialog.body')}</p>
      </ConfirmDialog>
    </section>
  );
}

/** The "Product info" tab: the store's parts with Tailored and Images chips, and the editor of the selected part. */
export function ProductInfoPanel() {
  const t = useTranslations('catalog.productInfo');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const canEdit = can('tailoring.edit');
  const [search, setSearch] = useState('');
  const text = useDeferredValue(search.trim());
  const [selected, setSelected] = useState<string | null>(null);
  const { data: list, error } = useTailoringList(storeKey, { text, offset: 0, limit: 200 });
  const { data: detail } = useTailoringDetail(storeKey, selected);
  const current = list?.rows.find((r) => r.productId === selected);

  return (
    <div className="grid gap-400 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className={`${cardClass} flex flex-col gap-300`} aria-labelledby="pi-list">
        <h2 id="pi-list" className="text-title-1 font-semibold text-text">
          {t('title')}
        </h2>
        <label>
          <span className="sr-only">{t('search')}</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className={inputClass} />
        </label>
        {error ? (
          <p role="alert" className={errorNote}>
            {t('errors.load')}
          </p>
        ) : null}
        <ul className="flex max-h-[calc(var(--space-6400)*2)] flex-col gap-100 overflow-y-auto">
          {(list?.rows ?? []).map((row) => (
            <li key={row.productId}>
              <button
                type="button"
                aria-pressed={selected === row.productId}
                onClick={() => setSelected(row.productId)}
                className={`flex w-full flex-col items-start gap-100 rounded-300 px-300 py-250 text-left focus-visible:outline-2 focus-visible:outline-border-active ${selected === row.productId ? 'bg-bg-active-subdued' : 'hover:bg-bg-surface-hover'}`}
              >
                <span className="text-body-2 font-semibold text-text">{getLocalizedString(row.name, locale)}</span>
                <span className="flex flex-wrap items-center gap-150">
                  <span className={`font-mono text-caption-1 ${selected === row.productId ? "text-text" : "text-text-subdued"}`}>{row.sku}</span>
                  {row.tailored ? <Chip tone="info">{t('chips.tailored')}</Chip> : null}
                  {row.hasTailoredImages ? <Chip tone="success">{t('chips.images')}</Chip> : null}
                </span>
              </button>
            </li>
          ))}
          {list && list.rows.length === 0 ? <li className={hintClass}>{t('empty')}</li> : null}
        </ul>
      </section>

      {detail && selected ? (
        <Editor key={selected} detail={detail} name={current ? getLocalizedString(current.name, locale) : detail.sku} canEdit={canEdit} />
      ) : (
        <section className={`${cardClass} flex flex-col gap-300`}>
          <p className="text-body-2 font-medium text-text-subdued">{t('pick')}</p>
          <aside className="flex flex-col gap-200 rounded-300 bg-bg-surface-subdued p-400">
            <h3 className="text-body-2 font-bold text-text">{t('masterRecord')}</h3>
            <p className="text-body-2 text-text">{t('masterNote')}</p>
          </aside>
        </section>
      )}
    </div>
  );
}
