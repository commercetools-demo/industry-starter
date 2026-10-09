'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/** How long a toast stays (design: 5 s). */
export const TOAST_DURATION_MS = 5000;

export interface ToastOptions {
  message: string;
  /** Optional link, for example "View cart". */
  action?: { label: string; href: string };
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (toast: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Shows a toast from any client component below `ToastProvider`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}

/**
 * Polite live region: always mounted so that assistive technology announces text changes.
 * Visually hidden; the visible toast is a separate element.
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('ui.toast');
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const nextId = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [id]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <LiveRegion message={toast?.message ?? ''} />
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-60 flex -translate-x-1/2 items-center gap-5 rounded-md bg-navy-900 px-5 py-3.5 text-sm text-text-on-brand shadow-lg" data-toast>
          <span aria-hidden="true">{toast.message}</span>
          {toast.action ? (
            <Link href={toast.action.href} className="font-medium text-brand-300 hover:text-brand-200" onClick={dismiss}>
              {toast.action.label}
            </Link>
          ) : null}
          <button type="button" onClick={dismiss} aria-label={t('dismiss')} className="text-lg leading-none text-brand-300 hover:text-brand-200">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
