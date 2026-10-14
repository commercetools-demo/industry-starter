/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside `ref` while `active`, moves focus into it on activation and gives focus back to the element that had it
 * before (WCAG 2.4.3) when the trap ends, unless that element is gone. Escape handling is the caller's or the overlay stack's job.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const items = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (items()[0] ?? root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref, active]);
}
