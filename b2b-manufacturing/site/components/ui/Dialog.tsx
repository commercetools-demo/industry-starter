'use client';
import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/** Modal dialog: role dialog, labelled, focus trapped, Escape and backdrop close, focus returns to the opener. */
export function Dialog({ open, onClose, title, children, closeLabel = 'Close' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; closeLabel?: string }) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, open, onClose);
  if (!open) return null;
  return (
    <div className="modal on" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} data-testid="dialog-backdrop">
      <div className="box" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <h2 id={titleId} style={{ font: '600 24px/1.2 var(--font-display)' }}>{title}</h2>
        {children}
        <button type="button" className="btn o sm" onClick={onClose}>{closeLabel}</button>
      </div>
    </div>
  );
}
