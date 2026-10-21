'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import IconButton from './IconButton';
import { useDialog } from './use-dialog';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  side?: 'right' | 'left';
  /** `wide` is 620px (the locale chooser); the default is 440px. */
  width?: 'default' | 'wide';
  children: ReactNode;
}

export default function Drawer({ open, onClose, title, footer, side = 'right', width = 'default', children }: DrawerProps) {
  const t = useTranslations('ui.drawer');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog({ open, onClose, ref: panelRef });

  const hidden = side === 'right' ? 'translate-x-full' : '-translate-x-full';
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="drawer-overlay"
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
        data-open={open}
        tabIndex={-1}
        className={cn(
          'transition-drawer fixed bottom-0 top-0 z-90 flex flex-col bg-canvas shadow-lg',
          width === 'wide' ? 'w-[min(620px,100vw)]' : 'w-[min(440px,100vw)]',
          side === 'right' ? 'right-0' : 'left-0',
          open ? 'visible translate-x-0' : `invisible ${hidden}`,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-[22px]">
          <h2 id={titleId} className="m-0 font-display text-[19px] font-bold">
            {title}
          </h2>
          <IconButton label={t('close')} icon="x" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {footer ? <div className="border-t border-line bg-surface px-6 py-5">{footer}</div> : null}
      </div>
    </>
  );
}
