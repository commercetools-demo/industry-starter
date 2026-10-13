// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Page-level accessibility harness (workstream Y): renders a page body inside the real store shell (skip link, utility bar, header,
// category navigation, main, footer, store picker host, garage provider) in de-DE or en-US, for the default theme or a themed store,
// and runs axe on the whole document (landmarks, one h1, title, language, skip link). jsdom cannot compute colours, so contrast is
// covered by scripts/contrast-report.mjs and the browser pass. Only tests import this file.
//
// Every test file that uses it must mock the locale-aware navigation:
//   vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
import { render, screen } from '@testing-library/react';
import axeCore from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { vi } from 'vitest';
import { CartProvider } from '@/context/CartProvider';
import { GarageProvider } from '@/context/GarageProvider';
import { CategoryNav } from '@/components/shell/CategoryNav';
import { Footer } from '@/components/shell/Footer';
import { Header } from '@/components/shell/Header';
import { MAIN_ID, SkipLink } from '@/components/shell/SkipLink';
import { UtilityBar } from '@/components/shell/UtilityBar';
import { StorePickerHost } from '@/components/store-picker/StorePickerHost';
import type { Cart, NavCategory, StoreSettings } from '@/lib/types';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { branchesResponse, settings } from '@/test/shell-fixtures';
import { emptyState } from '@/test/vehicle';

// axe probes canvas for icon ligatures; jsdom has none and logs a "not implemented" error per call.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

export const LOCALES = ['de-DE', 'en-US'] as const;
export type Locale = (typeof LOCALES)[number];
export const STORE = 'mau-reseller-north';

/** The default theme store and a themed reseller store (own name, logo, no help/track links, a long German-looking name). */
export const THEMES: Record<'default' | 'themed', StoreSettings> = {
  default: settings,
  themed: { ...settings, name: 'Nordlicht Kfz-Ersatzteile und Zubehör Großhandel', logoUrl: 'https://images.example.test/nordlicht-logo.png', helpUrl: undefined, trackUrl: undefined },
};

export const NAV_CATEGORIES: NavCategory[] = [
  { id: 'c1', slug: 'brakes', name: 'Brakes' },
  { id: 'c2', slug: 'filters', name: 'Filters' },
];

const messagesOf = (locale: Locale) => (locale === 'de-DE' ? deDE : enUS);

export interface PageOptions {
  locale?: Locale;
  theme?: 'default' | 'themed';
  signedIn?: boolean;
  /** Seeds the cart context (CartProvider) for the cart page. */
  cart?: Cart | null;
  /** Extra SWR cache entries (the server reads that seed the client hooks). */
  fallback?: Record<string, unknown>;
  /** Render without the shell (dialogs, error boundaries own the whole viewport). */
  bare?: boolean;
  /** Rendered between the skip link and the utility bar, like the impersonation banner of the store layout. */
  banner?: ReactNode;
}

/** A fetch stub for the shell's hooks: branches, cart summary, garage. Unknown routes answer 404 like the real handlers. */
export function stubShellFetch(extra: Record<string, unknown> = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = String(input).split('?')[0];
      const body = path in extra ? extra[path] : path === '/api/cart/summary' ? { count: 0 } : path === '/api/garage' ? emptyState : path === '/api/store-context/branches' ? branchesResponse({ chosen: true }) : null;
      if (body === null) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
}

/** Renders `ui` as the page body inside the store shell. Returns the document element for axe. */
export function renderStorePage(ui: ReactElement, { locale = 'de-DE', theme = 'default', signedIn = false, cart, fallback = {}, bare = false, banner }: PageOptions = {}) {
  const store = THEMES[theme];
  document.documentElement.lang = locale;
  document.title = `${store.name} | Test`;
  const body = bare ? (
    <main id={MAIN_ID}>{ui}</main>
  ) : (
    <StorePickerHost initial={branchesResponse({ chosen: true })}>
      <div className="flex min-h-screen flex-col">
        <SkipLink />
        {banner}
        <UtilityBar store={STORE} settings={store} pickup={{ option: 'today', branchName: 'Küstenwerk Hamburg-Harburg' }} />
        <Header store={STORE} settings={store} signedIn={signedIn} />
        <CategoryNav store={STORE} categories={NAV_CATEGORIES} />
        <main id={MAIN_ID} className="flex-1">
          {ui}
        </main>
        <Footer store={STORE} storeName={store.name} />
      </div>
    </StorePickerHost>
  );
  const content = cart === undefined ? body : <CartProvider initialCart={cart}>{body}</CartProvider>;
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesOf(locale)}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback: { '/api/garage': emptyState, ...fallback } }}>
        <GarageProvider lookupEnabled={false}>{content}</GarageProvider>
      </SWRConfig>
    </NextIntlClientProvider>,
  );
}

const normalise = (text: string) => text.toLowerCase().replace(/[\s ]+/g, ' ').trim();

/** WCAG 2.5.3 Label in Name: an element with an aria-label and visible text must contain that text in its accessible name (axe's own rule is experimental and blind in jsdom). */
export function labelInNameMismatches(root: ParentNode = document): Element[] {
  return [...root.querySelectorAll('button[aria-label], a[aria-label], [role="button"][aria-label]')].filter((el) => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll('[aria-hidden="true"], .sr-only').forEach((n) => n.remove());
    // Words in different elements are separated by a space, as they are when rendered ("Filter" and the badge "1").
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
    const visible = normalise(parts.join(' '));
    // Only words count (a lone symbol such as "+" or an arrow is not a label).
    return /\p{L}{2}/u.test(visible) && !normalise(el.getAttribute('aria-label') ?? '').includes(visible);
  });
}

/** axe over the whole document, so page-level rules (landmarks, one h1, title, lang, skip link) apply; label-in-name mismatches are reported as violations too. */
export async function axePage() {
  await screen.findAllByRole('main');
  const results = await axeCore.run(document, { rules: { 'color-contrast': { enabled: false } } });
  const mismatches = labelInNameMismatches();
  if (mismatches.length > 0) {
    results.violations.push({
      id: 'label-in-name',
      impact: 'serious',
      tags: ['wcag253'],
      description: 'Visible text of a control must be part of its accessible name (WCAG 2.5.3)',
      help: 'Visible label text must be contained in the accessible name',
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html',
      nodes: mismatches.map((el) => ({ html: el.outerHTML.slice(0, 200), target: [el.tagName.toLowerCase()], failureSummary: `aria-label "${el.getAttribute('aria-label')}" does not contain the visible text "${el.textContent?.trim()}"` })),
    } as never);
  }
  return results;
}
