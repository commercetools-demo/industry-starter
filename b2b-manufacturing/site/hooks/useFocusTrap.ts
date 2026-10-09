'use client';
import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** While `active`: Tab cycles inside `ref`, Escape calls `onEscape`, and focus goes back to the previously focused element on close. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (container.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? container).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onEscape(); return; }
      if (event.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) { event.preventDefault(); return; }
      const first = list[0]!; const last = list[list.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [active, ref, onEscape]);
}
