import type { ReactElement, ReactNode } from 'react';
import { FOCUS_RING } from '@/components/ui/focus';

/** Link style of the auth pages (visible focus ring included). */
export const AUTH_LINK = `rounded-pill font-display text-sm font-semibold text-text-link underline underline-offset-4 ${FOCUS_RING}`;

/** The frame of all four auth pages: a honey-tinted band with one centred card (max 440 px). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }): ReactElement {
  return (
    <section className="bg-surface-brand-subtle px-5 py-10 md:py-12">
      <div className="mx-auto flex w-full max-w-110 flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm md:p-10">
        <header className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{title}</h1>
          {subtitle ? <p className="m-0 text-md text-text-muted">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </section>
  );
}
