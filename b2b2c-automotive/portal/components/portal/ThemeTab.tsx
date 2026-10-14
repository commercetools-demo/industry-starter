'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store & channels, tab Theme (workstream U-06): the embedded Contentools ThemeManager on the left, the storefront preview on the
// right. A successful theme save (seen by observing the proxy call) shows the toast of decision 13 and reloads the preview;
// "Reset to Malva default" deletes the store's theme after a confirmation.
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ContentoolsWrapper } from '@/components/contentools/ContentoolsWrapper';
import { EditorBoundary } from '@/components/contentools/EditorBoundary';
import { observeThemeSaves } from '@/components/contentools/save-observer';
import { Dialog } from '@/components/portal/Dialog';
import { buttonDanger, buttonSecondary, cardClass, errorNote, sectionTitle } from '@/components/portal/kit';
import { StorefrontPreview } from '@/components/portal/StorefrontPreview';
import { useToast } from '@/context/ToastContext';
import { failureText } from '@/hooks/sellerHttp';
import { useStoreActions } from '@/hooks/storeApi';
import { CONTENTOOLS_PROXY_BASE } from '@/lib/contentools/origin';

export interface ThemeTabProps {
  locale: string;
  storeKey: string;
  connected: boolean;
  projectKey: string;
  parentUrl: string;
  /** Host of the storefront ("shop.example.com") and the theme cache window, for the save toast. */
  host: string;
  cacheSeconds: number;
}

export function ThemeTab({ locale, storeKey, connected, projectKey, parentUrl, host, cacheSeconds }: ThemeTabProps) {
  const t = useTranslations('store.theme');
  const { toast } = useToast();
  const { resetTheme } = useStoreActions();
  const [reloadKey, setReloadKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [resetError, setResetError] = useState('');

  const onSaved = useCallback(() => {
    toast(t('saved', { host, seconds: cacheSeconds }));
    setReloadKey((n) => n + 1);
  }, [toast, t, host, cacheSeconds]);

  useEffect(() => {
    if (!connected) return;
    return observeThemeSaves({ proxyBase: CONTENTOOLS_PROXY_BASE, storeKey, onSaved });
  }, [connected, storeKey, onSaved]);

  async function onReset() {
    setResetError('');
    const result = await resetTheme();
    if (!result.ok) return setResetError(failureText(result, t('resetFailed')));
    setConfirming(false);
    toast(t('resetDone', { seconds: cacheSeconds }));
    setReloadKey((n) => n + 1);
  }

  return (
    <div className="grid gap-400 2xl:grid-cols-[3fr_2fr]">
      <section className={`${cardClass} flex min-w-0 flex-col gap-300`} aria-labelledby="theme-editor">
        <div className="flex flex-wrap items-center justify-between gap-300">
          <h2 id="theme-editor" className={sectionTitle}>
            {t('title')}
          </h2>
          <button type="button" onClick={() => setConfirming(true)} disabled={!connected} className={buttonDanger}>
            {t('reset')}
          </button>
        </div>
        <EditorBoundary presets>
          <ContentoolsWrapper tab="theme" parentUrl={parentUrl} locale={locale} storeKey={storeKey} connected={connected} projectKey={projectKey} />
        </EditorBoundary>
      </section>
      <section className={`${cardClass} min-w-0`} aria-label={t('preview.title')}>
        <StorefrontPreview reloadKey={reloadKey} />
      </section>
      <Dialog
        open={confirming}
        title={t('resetTitle')}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" onClick={() => setConfirming(false)} className={buttonSecondary}>
              {t('cancel')}
            </button>
            <button type="button" onClick={onReset} className={buttonDanger}>
              {t('confirmReset')}
            </button>
          </>
        }
      >
        <p>{t('resetBody')}</p>
        {resetError ? <p role="alert" className={errorNote}>{resetError}</p> : null}
      </Dialog>
    </div>
  );
}
