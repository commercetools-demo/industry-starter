// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreTheme } from '@/lib/contentools/theme';
import { buildThemeCss } from '@/lib/theme/adapter';

export const metadata: Metadata = { title: 'Theme preview (dev)', robots: { index: false } };

// Dev-only preview of what the adapter does to a store's theme. Elements are drawn from tokens only; the style element
// carries the sanitised adapter output (and nothing else from the theme).
export default async function ThemePreview({ params }: { params: Promise<{ store: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { store } = await params;
  const css = buildThemeCss(await getStoreTheme(store));
  return (
    <main className="mx-auto max-w-content bg-surface-page p-5 font-body text-text" data-testid="theme-preview" data-store={store}>
      <style id="store-theme-preview" dangerouslySetInnerHTML={{ __html: css }} />
      <h1 className="font-display text-3xl text-text-strong">Theme preview: {store}</h1>
      <p className="mt-2 text-sm text-text-muted">Brand, accent, radius, fonts and secondary buttons follow the theme. Fit and status colours never do.</p>

      <section className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" data-testid="btn-primary" className="rounded-sm bg-action px-5 py-3 font-display text-md text-text-on-brand hover:bg-action-hover">
          Add to cart
        </button>
        <button
          type="button"
          data-testid="btn-secondary"
          className="rounded-sm border px-5 py-3 font-display text-md"
          style={{ background: 'var(--btn-secondary-bg, var(--color-action))', borderColor: 'var(--btn-secondary-border, transparent)', color: 'var(--btn-secondary-fg, var(--color-text-on-brand))' }}
        >
          Compare
        </button>
        <span data-testid="price" className="font-display text-2xl text-text-price">
          $129.00
        </span>
        <span data-testid="chip" className="rounded-pill bg-accent-100 px-4 py-2 font-ui text-xs text-text">
          Free pickup
        </span>
      </section>

      <section data-testid="hero" className="mt-5 rounded-lg bg-surface-brand-deep p-6 text-text-on-brand">
        <h2 className="font-display text-2xl">Parts that fit your car</h2>
      </section>

      <section className="mt-5 flex flex-wrap gap-4 font-ui text-sm">
        <span data-testid="fit-ok" className="rounded-sm bg-success-50 px-4 py-2 text-success-600">
          Fits your vehicle
        </span>
        <span data-testid="fit-no" className="rounded-sm bg-danger-50 px-4 py-2 text-danger-600">
          Does not fit
        </span>
        <div data-testid="card" className="rounded-md bg-surface p-4 shadow-card">
          Card
        </div>
      </section>
    </main>
  );
}
