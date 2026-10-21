'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import IconButton from './IconButton';
import { useDialog } from './use-dialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const t = useTranslations('ui.modal');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog({ open, onClose, ref: panelRef });

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="modal-overlay"
        onClick={onClose}
        className={cn(
          'transition-state fixed inset-0 z-80 bg-overlay',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className={cn(
          'transition-state fixed left-1/2 top-1/2 z-90 max-h-[88vh] w-[min(560px,94vw)] -translate-x-1/2 overflow-y-auto rounded-panel bg-canvas shadow-lg',
          open ? 'visible -translate-y-1/2 opacity-100' : 'invisible -translate-y-[46%] opacity-0',
        )}
      >
        <div className="flex items-center justify-between px-7 pb-2 pt-6">
          <h2 id={titleId} className="m-0 font-display text-[22px] font-bold">
            {title}
          </h2>
          <IconButton label={t('close')} icon="x" onClick={onClose} />
        </div>
        <div className="px-7 pb-7 pt-2">{children}</div>
      </div>
    </>
  );
}
