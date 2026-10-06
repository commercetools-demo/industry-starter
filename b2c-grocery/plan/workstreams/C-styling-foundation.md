# C — Styling foundation and tokens

**Specs:** `storefront-styling-foundation` (all), `malva-storefront-design/storefront-design-system` (Token-driven visual language, Rounded/washed, Layout and motion — CSS part)
**Depends on:** A · **Unblocks:** H · **Decisions:** D-010
**Source of truth for tokens:** `design/source/_ds/styles.css` (do not edit it) and `design/DESIGN.md`.

## Goal
Tailwind v4 compiles with the Organic tokens; fonts are self-hosted by Next at build time; the Organic component classes exist for H to apply.

## Design
- `postcss.config.mjs`: `const config = { plugins: { '@tailwindcss/postcss': {} } }; export default config;`
- `app/globals.css` order: `@import 'tailwindcss';` → `@source inline(...)` safelists for `col-span-1…12` and `md:`/`lg:` variants (copy from the `/nextjs-setup-project` command) → `@theme { … }` → `:root { … }` → `@import './organic-components.css';` → base rules.
- **Tokens (copy values exactly from the design `styles.css`):**
  - `@theme`: all `--color-*` (bg, surface, text, accent, accent-2, divider, neutral-100…900, accent-100…900, accent-2-100…900), `--radius-sm/md/lg`, `--shadow-sm/md/lg`, `--font-heading: var(--font-caprasimo), system-ui, sans-serif;`, `--font-body: var(--font-figtree), system-ui, sans-serif;`.
  - `:root`: `--space-1` 4.4px, `--space-2` 8.8px, `--space-3` 13.2px, `--space-4` 17.6px, `--space-6` 26.4px, `--space-8` 35.2px, `--font-heading-weight: 400`. Use these via `p-[var(--space-4)]` or in component CSS.
  - Remove any scaffold token (`--color-cream`, `--color-terra`, Inter).
- **Fonts:** in `app/layout.tsx` use `next/font/google`: `Caprasimo({ weight: '400', subsets: ['latin'], variable: '--font-caprasimo', display: 'swap' })` and `Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' })`; apply both `.variable` classes on `<html>`. `next/font/google` downloads at build and serves from our domain — no runtime Google request. (Needs network at build time.)
- **`app/organic-components.css`:** port from the design CSS, inside `@layer components`, these classes using tokens only: `.btn` (+ `-primary -secondary -ghost -icon -block`), `.field`, `.input`, `.radio` (+ `.dot`), `.seg` / `.seg-opt`, `.card` (+ `-kicker -title -body -meta`), `.elev-sm/md/lg`, `.tag` (+ `-accent -accent-2 -neutral -outline`), `.nav`, `.nav-brand`, `.table`, `.dialog-backdrop`, `.dialog` (+ `-title -body -actions`), `.washed`, `.lift`, `.blob`, keyframes `orgIn`, `orgUp`. Add `@media (prefers-reduced-motion: reduce)` disabling `orgIn`, `orgUp` and `.lift` transform.
- `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`, `::selection`, disabled 45% — copy from the design.
- `next.config.ts` images: keep `unoptimized: true`, `remotePatterns` for `storage.googleapis.com` and `**` https (the plugin wrapper is added in D).
- Page container utility: class `.page` = `max-width: 1360px; margin: 0 auto; padding-inline: var(--space-8);`.

## Tasks
- [ ] C-01 Write `postcss.config.mjs` and a new `app/globals.css` skeleton (import tailwind, safelists). Remove old scaffold CSS. `npm run build` passes.
- [ ] C-02 Add the `@theme` and `:root` tokens exactly as in the design CSS. Test `app/globals.css.test.ts`: reads the file and asserts presence of `--color-accent: #c67139`, `--color-bg: #f5ead8`, `--radius-lg: 28px`, `--space-4: 17.6px`, and absence of `cream`, `terra`, `Inter`.
- [ ] C-03 Add fonts in `app/layout.tsx` via `next/font/google` as designed; mock `next/font/google` in Vitest (`vitest.setup.ts`) returning `{ variable: 'font-var', className: 'font-cls' }`. Test the layout renders `<html>` with both variable classes.
- [ ] C-04 Port the Organic component classes into `app/organic-components.css` (list above) using only token variables; add `.page`. Test (`organic-components.css.test.ts`): asserts each class name appears, no hex literal exists in the file, and the themed states exist: `.btn-primary:hover`, `.btn-primary:active`, `.btn-secondary:hover`, `.btn-ghost:hover`.
- [ ] C-05 Add reduced-motion rules and `:focus-visible`, `::selection`, `:disabled` base rules, plus class `.page-enter { animation: orgIn .35s ease both }` (H applies it to `<main>`). Test asserts the `prefers-reduced-motion` block covers `.lift`, `.page-enter`, `orgIn`, and that `.page-enter` uses `orgIn`.
- [ ] C-06 Add `images: { unoptimized: true, remotePatterns }` to `next.config.ts` (the scaffold does not have it); test `next.config.test.ts` imports the config and asserts them. Report manual tests M-C-1, M-C-2.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Build compiles without tailwind.config | `npm run build` in verify + A's versions test |
| Scaffold palette removed | C-02 test |
| Network requests (no Google at runtime) | C-03: layout test asserts no `<link href*="fonts.googleapis.com">` in rendered markup |
| Optimizer disabled | C-06 test |
| Token used for color / Accent as body text | `check:tokens` (B-06) + review |
| Reduced motion | C-05 test |

## Manual tests to report
- M-C-1: `npm run dev`, open `/`, DevTools → Network: no request to `fonts.googleapis.com`/`fonts.gstatic.com`; headings render in Caprasimo, body in Figtree.
- M-C-2: Tab through the demo page: focus ring is a 2px terracotta outline, not the browser default.

## Definition of done
Tokens identical to the design CSS; no hex outside `globals.css`; component classes exist; `verify` passes.
