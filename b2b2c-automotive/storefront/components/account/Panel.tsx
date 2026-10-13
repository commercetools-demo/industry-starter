// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * The page heading of an account page. It takes the focus when the page opens (workstream Q-13: focus to the page `h1` on navigation), so a
 * keyboard or screen reader user starts at the new page and not at the menu they just used.
 */
export function PageTitle({ children, id = 'account-title' }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 id={id} ref={ref} tabIndex={-1} className="m-0 font-display text-2xl font-semibold text-text focus:outline-none">
      {children}
    </h1>
  );
}

/** A bordered white panel (the kit's card) with an optional second level heading. */
export function Panel({ title, titleId, children, className = '' }: { title?: ReactNode; titleId?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={`grid content-start gap-4 rounded-md border border-border bg-surface p-5 ${className}`.trim()}>
      {title ? (
        <h2 id={titleId} className="m-0 font-display text-lg font-semibold text-text">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Loading, empty and error states of an account page: plain words, and a retry for the error. */
export function StateMessage({ kind, title, hint, action, onRetry }: { kind: 'loading' | 'empty' | 'error'; title?: ReactNode; hint?: ReactNode; action?: ReactNode; onRetry?: () => void }) {
  const t = useTranslations('account');
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="grid gap-3" data-state="loading">
        <span className="sr-only">{t('loading')}</span>
        <span aria-hidden className="block h-5 w-1/3 animate-pulse rounded-xs bg-surface-subtle" />
        <span aria-hidden className="block h-7 w-full animate-pulse rounded-xs bg-surface-subtle" />
        <span aria-hidden className="block h-7 w-2/3 animate-pulse rounded-xs bg-surface-subtle" />
      </div>
    );
  }
  const error = kind === 'error';
  return (
    <div data-state={kind} role={error ? 'alert' : undefined} className={`grid gap-3 rounded-sm p-4 ${error ? 'bg-danger-50' : 'bg-surface-subtle'}`}>
      <p className={`m-0 font-ui text-md font-medium ${error ? 'text-danger-600' : 'text-text'}`}>{title ?? (error ? t('errorTitle') : null)}</p>
      {hint ?? (error ? <p className="m-0 font-ui text-sm text-text-body">{t('errorBody')}</p> : null)}
      {error && onRetry ? (
        <div>
          <Button variant="secondary" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

/**
 * The account's email as a hidden `username` field, so password managers file a changed password under the right login and the browser stops
 * warning that a password form has no username. Not focusable, not announced.
 */
export function HiddenUsername({ value }: { value?: string }) {
  return <input type="text" name="username" autoComplete="username" value={value ?? ''} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />;
}

/** A success or error banner announced to assistive technology. Rendered empty (but present) so the live region is registered before the text arrives. */
export function Notice({ tone, children }: { tone: 'success' | 'error'; children?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      {children ? <p className={`m-0 rounded-sm p-3 font-ui text-sm ${tone === 'error' ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600'}`}>{children}</p> : null}
    </div>
  );
}
