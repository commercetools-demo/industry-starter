/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type OverlayId = 'bu' | 'cmd' | 'bell' | 'user' | 'cp' | 'drawer';

/** Popovers anchored to the top bar exclude each other; the palette, Copilot and drawer stack on top. */
const POPOVERS: readonly OverlayId[] = ['bu', 'bell', 'user'];

interface OverlayApi {
  stack: OverlayId[];
  isOpen: (id: OverlayId) => boolean;
  open: (id: OverlayId, trigger?: HTMLElement | null) => void;
  close: (id: OverlayId) => void;
  toggle: (id: OverlayId, trigger?: HTMLElement | null) => void;
  closeTop: () => void;
}

const OverlayContext = createContext<OverlayApi | null>(null);

/**
 * One stack for every overlay (spec: Escape closes the top-most only). The element that opened an overlay gets focus back
 * when it closes (drawer focus return, M-R-2). The stack lives in a ref as well as in state so several calls in one event
 * (close the drawer, open the palette) see each other.
 */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<OverlayId[]>([]);
  const stackRef = useRef<OverlayId[]>([]);
  const triggers = useRef(new Map<OverlayId, HTMLElement>());

  const update = useCallback((next: OverlayId[]) => {
    stackRef.current = next;
    setStack(next);
  }, []);

  const open = useCallback(
    (id: OverlayId, trigger?: HTMLElement | null) => {
      const origin = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      if (origin && origin !== document.body) triggers.current.set(id, origin);
      update([...stackRef.current.filter((o) => o !== id && !(POPOVERS.includes(id) && POPOVERS.includes(o))), id]);
    },
    [update],
  );

  const close = useCallback(
    (id: OverlayId) => {
      if (!stackRef.current.includes(id)) return;
      update(stackRef.current.filter((o) => o !== id));
      const el = triggers.current.get(id);
      triggers.current.delete(id);
      if (el?.isConnected) queueMicrotask(() => el.focus());
    },
    [update],
  );

  const closeTop = useCallback(() => {
    const top = stackRef.current.at(-1);
    if (top) close(top);
  }, [close]);

  const toggle = useCallback((id: OverlayId, trigger?: HTMLElement | null) => (stackRef.current.includes(id) ? close(id) : open(id, trigger)), [close, open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stackRef.current.length > 0) {
        event.preventDefault();
        closeTop();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeTop]);

  const value = useMemo<OverlayApi>(() => ({ stack, isOpen: (id) => stack.includes(id), open, close, toggle, closeTop }), [stack, open, close, toggle, closeTop]);
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayApi {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay needs OverlayProvider');
  return ctx;
}
