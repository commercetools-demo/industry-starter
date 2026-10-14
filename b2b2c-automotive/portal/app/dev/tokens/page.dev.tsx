import type { Metadata } from 'next';
import { ThemeToggleDev } from '@/components/dev/ThemeToggleDev';
import { listTokens } from '@/lib/dev/token-list';

export const metadata: Metadata = { title: 'Tokens (dev)', robots: { index: false } };

const SENTENCE = 'Quarterly purchase orders';

// Dev-only specimen: registered as a page only outside production builds (next.config.ts pageExtensions).
export default function TokenSpecimen() {
  const { colors, spaces, radii, shadows, texts } = listTokens();
  return (
    <div className="min-h-screen bg-bg-page p-600 text-text">
      <header data-testid="topbar" className="flex h-topbar items-center justify-between rounded-400 bg-bg-topbar px-600 text-text-on">
        <span className="text-title-2 font-semibold">Admin kit specimen</span>
        <ThemeToggleDev />
      </header>

      <section aria-labelledby="sp-colours" className="mt-600 rounded-400 bg-bg-surface p-600" data-testid="surface-card">
        <h2 id="sp-colours" className="text-title-1 font-semibold">
          Colours
        </h2>
        <ul className="mt-400 grid grid-cols-2 gap-200 md:grid-cols-4">
          {colors.map((token) => (
            <li key={token} className="text-caption-2">
              <div data-testid={`swatch-${token}`} className="h-800 rounded-200 border border-border" style={{ background: `var(--${token})` }} />
              <span>{token}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sp-type" className="mt-600 rounded-400 bg-bg-surface p-600">
        <h2 id="sp-type" className="text-title-1 font-semibold">
          Type
        </h2>
        <p data-testid="font-sans" className="mt-400 font-sans text-body-1">
          {SENTENCE}
        </p>
        <ul className="mt-400">
          {texts
            .filter((t) => !t.includes('--'))
            .map((token) => (
              <li key={token} data-testid={`type-${token}`} style={{ fontSize: `var(--${token})`, lineHeight: 'normal' }}>
                {token}: {SENTENCE}
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="sp-space" className="mt-600 rounded-400 bg-bg-surface p-600">
        <h2 id="sp-space" className="text-title-1 font-semibold">
          Spacing
        </h2>
        <ul className="mt-400 space-y-100">
          {spaces.map((token) => (
            <li key={token} className="flex items-center gap-200 text-caption-2">
              <div data-testid={`space-${token}`} className="h-200 bg-bg-brand" style={{ width: `var(--${token})` }} />
              <span>{token}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sp-radius" className="mt-600 rounded-400 bg-bg-surface p-600">
        <h2 id="sp-radius" className="text-title-1 font-semibold">
          Radius and elevation
        </h2>
        <ul className="mt-400 flex flex-wrap gap-400 text-caption-2">
          {radii.map((token) => (
            <li key={token}>
              <div data-testid={`radius-${token}`} className="h-800 w-800 bg-bg-surface-subdued" style={{ borderRadius: `var(--${token})` }} />
              <span>{token}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-400 flex flex-wrap gap-400 text-caption-2">
          {shadows.map((token) => (
            <li key={token}>
              <div data-testid={`shadow-${token}`} className="h-800 w-1200 rounded-200 bg-bg-surface" style={{ boxShadow: `var(--${token})` }} />
              <span>{token}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
