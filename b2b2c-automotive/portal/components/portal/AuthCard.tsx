/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LogoMark } from '@/components/ui/Logo';

/** 440 px, composed from spacing tokens (256 + 128 + 48 + 8) because the kit has no token of that size. */
const CARD_WIDTH = 'max-w-[calc(var(--space-6400)+var(--space-3200)+var(--space-1200)+var(--space-200))]';

/** Centred auth card on the page canvas: logo mark and name, title, subtitle, body and a secondary link row. */
export function AuthCard({ title, subtitle, children, links }: { title: string; subtitle?: string; children: ReactNode; links?: ReactNode }) {
  const t = useTranslations('common');
  return (
    <main className="grid min-h-screen place-items-center overflow-y-auto bg-bg-page p-600">
      <section aria-labelledby="auth-title" className={`flex w-full ${CARD_WIDTH} flex-col gap-400 rounded-200 bg-bg-surface p-800 text-text`}>
        <div className="flex items-center gap-300">
          <LogoMark tone="on-light" />
          <p className="text-title-1 font-bold">{t('appName')}</p>
        </div>
        <div>
          <h1 id="auth-title" className="text-h5 font-bold">
            {title}
          </h1>
          {subtitle ? <p className="text-caption-1 font-medium text-text-subdued">{subtitle}</p> : null}
        </div>
        {children}
        {links ? <div className="flex flex-wrap justify-between gap-300">{links}</div> : null}
      </section>
    </main>
  );
}

export const fieldClass =
  'h-1100 w-full rounded-300 border border-border-input bg-bg-surface px-300 text-body-1 font-semibold text-text placeholder:text-text-disabled';
export const primaryButtonClass =
  'h-1200 w-full rounded-300 border border-border-on bg-bg-brand text-body-1 font-bold text-text-on shadow-button hover:bg-bg-brand-hover disabled:cursor-not-allowed disabled:bg-bg-brand-disabled';
export const secondaryButtonClass =
  'h-1200 w-full rounded-300 border border-border bg-transparent text-body-1 font-bold text-text hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:text-text-disabled';
export const linkClass = 'text-body-2 font-semibold text-text-active hover:text-text';

/** A labelled field row (label above, 44 px input). */
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-150">
      <label htmlFor={id} className="text-body-2 font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-caption-1 font-medium text-text-subdued">{hint}</p> : null}
    </div>
  );
}

export function ErrorNote({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="rounded-300 bg-bg-critical-subdued px-300 py-250 text-body-2 font-semibold">
      {children}
    </p>
  );
}
