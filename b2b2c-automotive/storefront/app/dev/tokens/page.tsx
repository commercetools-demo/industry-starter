// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readTokenList } from '@/lib/dev/token-list';

export const metadata: Metadata = { title: 'Tokens (dev)', robots: { index: false } };

const FONT_SAMPLES: Record<string, string> = {
  'font-display': 'font-display',
  'font-body': 'font-body',
  'font-utility': 'font-utility',
  'font-ui': 'font-ui',
  'font-button-alt': 'font-button-alt',
};

// Dev-only specimen of the automotive tokens. Everything is drawn from var(--token); there is no raw value here.
export default async function TokenSpecimen() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { colors, fonts, spaces, radii, shadows } = readTokenList();
  return (
    <main className="mx-auto max-w-page bg-surface-page p-5 font-body text-text">
      <h1 className="font-display text-3xl text-text-strong">Automotive tokens</h1>

      <section className="mt-6" aria-labelledby="colors">
        <h2 id="colors" className="font-display text-xl">Colours</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {colors.map((token) => (
            <li key={token} className="font-ui text-xs">
              <div data-testid={`swatch-${token}`} className="h-8 rounded-sm border border-border" style={{ background: `var(--${token})` }} />
              <span>{token}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="type">
        <h2 id="type" className="font-display text-xl">Type</h2>
        {fonts.map((token) => (
          <p key={token} data-testid={token} className={`mt-3 text-xl ${FONT_SAMPLES[token] ?? ''}`} style={{ fontFamily: `var(--${token})` }}>
            {token}: Brake pads for a 2019 Golf
          </p>
        ))}
        <button type="button" data-testid="btn-sample" className="mt-4 rounded-sm bg-action px-5 py-3 font-display text-md text-text-on-brand hover:bg-action-hover">
          Add to cart
        </button>
      </section>

      <section className="mt-6" aria-labelledby="space">
        <h2 id="space" className="font-display text-xl">Spacing</h2>
        {spaces.map((token) => (
          <div key={token} className="mt-2 flex items-center gap-3 font-ui text-xs">
            <div data-testid={`swatch-${token}`} className="h-3 bg-brand-700" style={{ width: `var(--${token})` }} />
            <span>{token}</span>
          </div>
        ))}
      </section>

      <section className="mt-6" aria-labelledby="radius">
        <h2 id="radius" className="font-display text-xl">Radius</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {radii.map((token) => (
            <div key={token} className="font-ui text-xs">
              <div data-testid={`swatch-${token}`} className="h-8 w-8 bg-neutral-200" style={{ borderRadius: `var(--${token})` }} />
              <span>{token}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="shadow">
        <h2 id="shadow" className="font-display text-xl">Shadow</h2>
        <div className="mt-3 flex flex-wrap gap-5">
          {shadows.map((token) => (
            <div key={token} data-testid={`swatch-${token}`} className="rounded-md bg-surface p-5 font-ui text-xs" style={{ boxShadow: `var(--${token})` }}>
              {token}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
