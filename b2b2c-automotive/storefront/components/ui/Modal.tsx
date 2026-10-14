// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Id of the element that names the dialog. */
  labelledBy: string;
  /** Element that gets focus back on close; defaults to the element that was focused when the modal opened. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * A native `<dialog>` opened with `showModal()`: the browser traps focus and marks the rest of the page inert. Escape and a
 * click on the backdrop close it. Focus returns to the opener on close.
 */
export function Modal({ open, onClose, labelledBy, returnFocusTo, className = '', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // Browsers move focus into the dialog; make sure it also happens where showModal does not (and when nothing inside is focusable).
      if (!dialog.contains(document.activeElement)) {
        const first = dialog.querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (first ?? dialog).focus();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Restore focus after the dialog has closed (by prop, Escape or the browser's own close).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      const target = returnFocusTo?.current ?? opener.current;
      if (target?.isConnected) target.focus();
      onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [returnFocusTo]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={`m-auto w-[calc(100%-var(--space-5))] max-w-content overflow-hidden rounded-lg bg-surface p-0 text-text shadow-dropdown backdrop:bg-surface-utility/60 ${className}`.trim()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          ref.current?.close();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        ref.current?.close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
