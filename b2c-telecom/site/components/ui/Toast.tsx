'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { FOCUS_RING_ON_DARK } from './focus';
import { CloseIcon } from './Icon';

/** Auto-dismiss delay. */
export const TOAST_MS = 4000;

export type ToastInput = { message: string; tone?: 'success' | 'error'; actionLabel?: string; href?: string };
export type ToastApi = { show: (toast: ToastInput) => void; dismiss: () => void };

type ActiveToast = ToastInput & { id: number };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

/** One toast at a time (a new one replaces the current one). The status region is always mounted. */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const t = useTranslations('common');
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remaining = useRef(TOAST_MS);
  const startedAt = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const startTimer = useCallback(
    (ms: number) => {
      clearTimer();
      remaining.current = ms;
      startedAt.current = Date.now();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setToast(null);
      }, ms);
    },
    [clearTimer],
  );

  const show = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      setToast({ ...input, id: counter.current });
      startTimer(TOAST_MS);
    },
    [startTimer],
  );

  const pause = useCallback(() => {
    if (timer.current === undefined) return;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (timer.current !== undefined) return;
    startTimer(remaining.current);
  }, [startTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);
  const tone = toast?.tone ?? 'success';

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-5 bottom-5 z-20 flex justify-center md:inset-x-auto md:right-7 md:justify-end">
        {toast ? (
          <div
            key={toast.id}
            data-tone={tone}
            data-surface="dark"
            onMouseEnter={pause}
            onMouseLeave={resume}
            onFocus={pause}
            onBlur={resume}
            className={cx(
              'pointer-events-auto flex w-full max-w-md items-center gap-5 rounded-lg px-6 py-5 text-sm shadow-lg md:w-auto',
              tone === 'error' ? 'bg-danger text-text-on-pink' : 'bg-brand-950 text-text-on-pink',
            )}
          >
            <span className="flex-1">{toast.message}</span>
            {toast.actionLabel && toast.href ? (
              <Link href={toast.href} className={cx('font-semibold text-text-on-pink underline underline-offset-4', FOCUS_RING_ON_DARK)}>
                {toast.actionLabel}
              </Link>
            ) : null}
            <button type="button" aria-label={t('toast.dismiss')} onClick={dismiss} className={cx('inline-flex size-11 items-center justify-center rounded-pill', FOCUS_RING_ON_DARK)}>
              <CloseIcon />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
