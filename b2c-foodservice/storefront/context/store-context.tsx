'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface StorePickerState {
  /** The picker modal is open. */
  open: boolean;
  /** Set when the picker was opened from a product: availability lines are shown for this SKU. */
  sku: string | null;
  /** "Ship to me instead" was chosen from the no-match state (H reads this to preselect Ship). */
  preferShip: boolean;
}

export interface StoreContextValue extends StorePickerState {
  openPicker: (context?: { sku?: string }) => void;
  closePicker: () => void;
  setPreferShip: (value: boolean) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** UI state of the store picker only. The chosen store itself lives in the session (see `useCollectionStore`). */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StorePickerState>({ open: false, sku: null, preferShip: false });

  const openPicker = useCallback((context?: { sku?: string }) => {
    setState((s) => ({ ...s, open: true, sku: context?.sku ?? null }));
  }, []);
  const closePicker = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const setPreferShip = useCallback((preferShip: boolean) => setState((s) => ({ ...s, preferShip })), []);

  const value = useMemo<StoreContextValue>(
    () => ({ ...state, openPicker, closePicker, setPreferShip }),
    [state, openPicker, closePicker, setPreferShip],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreContext must be used inside <StoreProvider>');
  return ctx;
}
