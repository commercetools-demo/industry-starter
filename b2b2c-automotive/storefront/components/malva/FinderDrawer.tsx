// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ResellerFinder } from '@/components/malva/ResellerFinder';
import { buttonClass } from '@/components/ui/Button';

interface Props {
  locale: string;
  productSlug?: string;
  opener: HTMLElement | null;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The side sheet that holds the finder (D7): `role="dialog"` with `aria-modal`, a focus trap, Escape, scrim and close button, focus
 * back to the opener, a `translate-x` slide that is off under `prefers-reduced-motion`, and a full-width sheet under the narrow
 * breakpoint. It opens from the right (from the left in right-to-left locales).
 */
export function FinderDrawer({ locale, productSlug, opener, onClose }: Props) {
  const t = useTranslations('malvaFinder');
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Slide in after the first paint; lock the page scroll while open.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Focus moves in on open and back to the opener on close.
  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => !el.hasAttribute('hidden'));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === firstItem || !panel.current?.contains(active))) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && (active === lastItem || !panel.current?.contains(active))) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div data-testid="finder-scrim" aria-hidden="true" className="absolute inset-0 bg-surface-utility/60" onClick={() => onCloseRef.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-state={shown ? 'open' : 'closed'}
        className={`absolute inset-y-0 flex w-full max-w-[30rem] flex-col bg-surface text-text shadow-dropdown transition-transform duration-300 motion-reduce:transition-none ltr:right-0 rtl:left-0 max-[40rem]:max-w-none ${
          shown ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <h2 id={titleId} className="m-0 font-display text-xl font-bold text-text">
              {t('title')}
            </h2>
            {productSlug ? <p className="m-0 font-ui text-xs text-text-muted">{t('forProduct')}</p> : null}
          </div>
          <button ref={closeButton} type="button" className={buttonClass('link')} onClick={() => onCloseRef.current()}>
            {t('close')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ResellerFinder mode="drawer" productSlug={productSlug} locale={locale} />
        </div>
      </div>
    </div>
  );
}
