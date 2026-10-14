/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { buttonPrimary, buttonSecondary } from './ui';

/**
 * A modal that asks before a change (withdraw, publish, reset). Focus moves in and stays inside, Escape and Cancel close it,
 * and the confirm button is disabled while the request runs.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-90 grid place-items-center bg-black-alpha-8 p-600">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex w-full max-w-widget-desktop-4col flex-col gap-400 rounded-400 bg-bg-surface p-600 shadow-modal">
        <h2 id={titleId} className="text-title-1 font-semibold text-text">
          {title}
        </h2>
        <div className="flex flex-col gap-200 text-body-2 text-text">{children}</div>
        <div className="flex justify-end gap-300">
          <button type="button" className={buttonSecondary} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={buttonPrimary} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
