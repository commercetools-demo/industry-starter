'use client';

import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A native `<dialog>` opened with `showModal()`: the focus trap, Escape and the backdrop come from the browser, and focus returns to
 * the button that opened it. Used for "remove a plan that has add-ons" (D-026) and nothing else.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onCancel}
      className="m-auto w-full max-w-md rounded-xl border border-border bg-surface p-7 text-text backdrop:bg-overlay"
    >
      <h2 id={titleId} className="m-0 mb-3 font-display text-2xl font-bold">
        {title}
      </h2>
      <div className="mb-6 text-md">{children}</div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
