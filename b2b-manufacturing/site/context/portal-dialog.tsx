'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/components/ui/Dialog';
import { SignInPanel } from '@/components/layout/SignInPanel';

interface PortalDialogValue { open: () => void; close: () => void }
const PortalDialogContext = createContext<PortalDialogValue>({ open: () => {}, close: () => {} });
export const usePortalDialog = () => useContext(PortalDialogContext);

/** One "Client portal" dialog shared by the top bar, nav and footer buttons. */
export function PortalDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const t = useTranslations('portalDialog');
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);
  return (
    <PortalDialogContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onClose={close} title={t('title')} closeLabel={t('close')}>
        <SignInPanel onNavigate={close} />
      </Dialog>
    </PortalDialogContext.Provider>
  );
}
