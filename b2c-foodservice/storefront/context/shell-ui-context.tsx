'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ShellUi {
  cartOpen: boolean;
  /** Opens the cart drawer. Workstream I mounts the drawer and calls `registerCartDrawer(true)`. */
  openCart: () => void;
  closeCart: () => void;
  /** True once a cart drawer is mounted; until then the cart button navigates to /cart. */
  cartDrawerMounted: boolean;
  registerCartDrawer: (mounted: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  localeOpen: boolean;
  setLocaleOpen: (open: boolean) => void;
}

const ShellUiContext = createContext<ShellUi | null>(null);

/** Open and close flags for the shell's overlays. Contract for I: mount the drawer, read `cartOpen`, call `closeCart`. */
export function ShellUiProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartDrawerMounted, registerCartDrawer] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const value = useMemo<ShellUi>(
    () => ({
      cartOpen, openCart, closeCart, cartDrawerMounted, registerCartDrawer,
      mobileNavOpen, setMobileNavOpen, localeOpen, setLocaleOpen,
    }),
    [cartOpen, openCart, closeCart, cartDrawerMounted, mobileNavOpen, localeOpen],
  );
  return <ShellUiContext.Provider value={value}>{children}</ShellUiContext.Provider>;
}

export function useShellUi(): ShellUi {
  const ctx = useContext(ShellUiContext);
  if (!ctx) throw new Error('useShellUi must be used inside <ShellUiProvider>');
  return ctx;
}
