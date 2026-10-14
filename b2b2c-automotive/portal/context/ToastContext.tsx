/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastApi {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), VISIBLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-600 z-90 flex justify-center">
        {message ? (
          <p className="rounded-300 bg-bg-brand px-500 py-300 text-body-2 font-semibold text-text-on shadow-popover">{message}</p>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast needs ToastProvider');
  return ctx;
}
