'use client';

import { useId, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/**
 * One accordion section: a header `button` with `aria-expanded` and `aria-controls`, a chevron that turns from right to
 * down, and content that enters with the shared `fade-up` motion (a 10 px translate; the utility is switched off under
 * `prefers-reduced-motion`). Closed content is removed from the tab order and the accessibility tree.
 */
export default function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="border-b border-line">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 border-0 bg-transparent py-4 text-left font-display text-[15px] font-semibold text-ink"
        >
          {title}
          <Icon name="chevR" size={18} className={cn('transition-state shrink-0 motion-reduce:transition-none', open && 'rotate-90')} />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className={cn('pb-5 text-[14px] leading-relaxed text-ink-2', open && 'fade-up')}>
        {children}
      </div>
    </div>
  );
}
