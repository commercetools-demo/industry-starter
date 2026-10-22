'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What Tab visits inside `container`, in order. A radio group is one stop (its checked radio, or the first when none is checked),
 * so the last radio in the markup is not a place Tab ever lands; treating it as the last stop let focus leave the dialog from the
 * store picker, whose last control is a group of radios (found by Q).
 */
function tabStops(container: HTMLElement): HTMLElement[] {
  const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  return all.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) return true;
    const group = all.filter(
      (o): o is HTMLInputElement => o instanceof HTMLInputElement && o.type === 'radio' && o.name === el.name && o.form === el.form,
    );
    return (group.find((r) => r.checked) ?? group[0]) === el;
  });
}

/**
 * The control last pressed with a pointer. Safari and Firefox on macOS and every touch browser do not focus a button on click,
 * so `document.activeElement` is `body` when a dialog opens from one; this is where focus goes back to on close.
 */
let lastPressed: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a[href], [role="button"], summary') : null;
      lastPressed = target;
    },
    true,
  );
}

/**
 * Dialog behaviour shared by Drawer and Modal. While `open`: focus moves inside `ref`, Tab and
 * Shift+Tab stay inside, Escape calls `onClose`, and body scroll is locked. On close the previous
 * focus is restored and scroll is unlocked.
 *
 * The panel renders `aria-hidden="true"` (a closed dialog) and this hook sets it to `false` while the dialog is open and
 * puts it back after focus has returned to the opener. React cannot do that ordering: a browser refuses `aria-hidden` on an
 * element that still holds focus (console warning "Blocked aria-hidden ... descendant retained focus", found by Q), and the
 * commit that sets the attribute runs before the effect cleanup that moves focus. The panel is `inert` meanwhile.
 */
export function useDialog({
  open,
  onClose,
  ref,
}: {
  open: boolean;
  onClose: () => void;
  ref: RefObject<HTMLElement | null>;
}): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return;

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = active && active !== document.body ? active : lastPressed?.isConnected ? lastPressed : null;
    container.setAttribute('aria-hidden', 'false');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = tabStops(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
      container.setAttribute('aria-hidden', 'true');
    };
  }, [open, ref]);
}
