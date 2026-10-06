'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export const TOAST_DURATION_MS = 2800;

export type ToastInput = {
  message: string;
  actionLabel?: string;
  /** Click handler for the action button. Use `href` for navigation instead. */
  onAction?: () => void;
  /** Locale-aware path the action navigates to, e.g. `/cart`. */
  href?: string;
};

type ToastApi = { show: (toast: ToastInput) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

/** One toast at a time, bottom-right; a new toast replaces the current one and restarts the 2.8 s timer. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((next: ToastInput) => {
    clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed right-(--space-8) bottom-(--space-8) z-[90]">
        {toast ? (
          <div className="card elev-lg pointer-events-auto flex-row items-center gap-(--space-4) px-(--space-4) py-(--space-3) animate-[orgUp_.28s_ease_both]">
            <div className="text-[15px]">{toast.message}</div>
            {toast.actionLabel && toast.href ? (
              <Button href={toast.href} className="text-[13px]">
                {toast.actionLabel}
              </Button>
            ) : null}
            {toast.actionLabel && !toast.href && toast.onAction ? (
              <Button
                className="text-[13px]"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
              >
                {toast.actionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
