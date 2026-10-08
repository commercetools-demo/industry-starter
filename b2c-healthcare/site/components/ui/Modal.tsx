'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('hidden'));
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Dialog title, also its accessible name. */
  title: string;
  children: ReactNode;
}

/**
 * Overlay + 520 px card. Escape and an overlay click close it; Tab stays inside; focus moves in on
 * open and returns to the element that had it (the opener) on close. The overlay "click target" is a
 * real, tab-skipped button behind the card (no clickable div); the close button is the last
 * focusable so the first field gets the initial focus.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const t = useTranslations('ui.modal');
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (focusableIn(card)[0] ?? card).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!card) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(card);
      if (items.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === card)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!card.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-navy-900/50 p-4">
      <button type="button" tabIndex={-1} aria-hidden="true" data-overlay onClick={onClose} className="absolute inset-0 size-full cursor-default" />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative grid w-full max-w-130 gap-4 rounded-lg bg-surface p-7 shadow-lg"
      >
        <h2 id={titleId} className="font-display text-xl font-semibold text-navy-900">
          {title}
        </h2>
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-sm text-xl text-navy-700 hover:bg-brand-50"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
