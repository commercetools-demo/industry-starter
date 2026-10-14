'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// A modal or side drawer of the Store, Company and Account screens (workstream U): focus moves in and stays inside, Escape closes,
// the background does not scroll under it. `variant="drawer"` slides in from the right (branch stock and branch forms).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  variant = 'modal',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'modal' | 'drawer';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const drawer = variant === 'drawer';
  return (
    <div className={`fixed inset-0 z-90 flex bg-black-alpha-8 ${drawer ? 'justify-end' : 'items-center justify-center p-600'}`}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex flex-col gap-400 bg-bg-surface p-600 shadow-modal ${drawer ? 'h-full w-full max-w-[calc(var(--space-6400)*3)] overflow-y-auto' : 'max-h-full w-full max-w-[calc(var(--space-6400)*2)] overflow-y-auto rounded-400'}`}
      >
        <h2 id={titleId} className="text-title-1 font-semibold text-text">
          {title}
        </h2>
        <div className="flex flex-col gap-300 text-body-2 text-text">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-300">{footer}</div> : null}
      </div>
    </div>
  );
}
