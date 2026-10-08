'use client';

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

/**
 * A native modal `<dialog>` (focus is trapped, Escape closes it, focus returns to the button that opened it). The caller owns `open`;
 * Escape and the browser's own close are reported through `onClose`. Where `showModal` does not exist (jsdom) the attribute is set.
 */
export function ModalDialog({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    } else if (!open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-7 text-text backdrop:bg-overlay"
    >
      {open ? children : null}
    </dialog>
  );
}
