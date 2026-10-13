// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

// The one finder drawer of a Malva page (D7). `MalvaShell` wraps the page in `FinderDrawerProvider`; the header button and every
// product card call `useFinderDrawer().open(...)`.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { FinderDrawer } from '@/components/malva/FinderDrawer';

export interface FinderDrawerOpenOptions {
  /** Localized slug of the product the shopper chose a reseller for; rows then link to the product at that reseller. */
  productSlug?: string;
  /** The element that gets focus back on close; the focused element when the drawer opened if omitted. */
  opener?: HTMLElement | null;
}

export interface FinderDrawerApi {
  open: (opts?: FinderDrawerOpenOptions) => void;
  close: () => void;
  isOpen: boolean;
}

interface State {
  productSlug?: string;
  opener: HTMLElement | null;
}

const FinderDrawerContext = createContext<FinderDrawerApi | null>(null);

export function FinderDrawerProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const open = useCallback((opts?: FinderDrawerOpenOptions) => {
    const active = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setState({ productSlug: opts?.productSlug, opener: opts?.opener ?? active });
  }, []);
  const close = useCallback(() => setState(null), []);
  const api = useMemo<FinderDrawerApi>(() => ({ open, close, isOpen: state !== null }), [open, close, state]);
  return (
    <FinderDrawerContext.Provider value={api}>
      {children}
      {state ? <FinderDrawer locale={locale} productSlug={state.productSlug} opener={state.opener} onClose={close} /> : null}
    </FinderDrawerContext.Provider>
  );
}

/** Opens and closes the finder drawer. Outside the provider it does nothing and reports closed (a component can render alone). */
export function useFinderDrawer(): FinderDrawerApi {
  return useContext(FinderDrawerContext) ?? NOOP;
}

const NOOP: FinderDrawerApi = { open: () => undefined, close: () => undefined, isOpen: false };
