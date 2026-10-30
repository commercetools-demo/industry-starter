'use client';

import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// The dialog (and, behind it, the barcode library) is fetched when a shopper first taps the camera, not with the page.
const ScanDialog = lazy(() => import('@/components/instore/scan/ScanDialog'));

interface ScannerApi {
  /** Opens the scanner dialog. */
  open: () => void;
  isOpen: boolean;
}

const ScannerContext = createContext<ScannerApi | null>(null);

/** Owns the open state of the scanner dialog so any button (header, home, bag, floating) can open it. */
export function ScannerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Once opened the dialog stays mounted (closed) so a second opening is instant; before that nothing is loaded.
  const [used, setUsed] = useState(false);
  const openDialog = useCallback(() => {
    setUsed(true);
    setOpen(true);
  }, []);
  const api = useMemo<ScannerApi>(() => ({ open: openDialog, isOpen: open }), [openDialog, open]);
  return (
    <ScannerContext.Provider value={api}>
      {children}
      {used ? (
        <Suspense fallback={null}>
          <ScanDialog open={open} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </ScannerContext.Provider>
  );
}

export function useScanner(): ScannerApi {
  const ctx = useContext(ScannerContext);
  if (!ctx) throw new Error('useScanner must be used inside <ScannerProvider>');
  return ctx;
}
