## ADDED Requirements

### Requirement: Tailwind v4 configuration

Styling SHALL use Tailwind v4 with no config file: `postcss.config.mjs` using `@tailwindcss/postcss`, and `app/globals.css` beginning with `@import 'tailwindcss'`. Dynamically composed grid classes (`col-span-1…12` and `md:`/`lg:` variants) SHALL be safelisted with `@source inline`.

#### Scenario: Build
- **WHEN** `npm run build` runs
- **THEN** Tailwind compiles from `globals.css` without a `tailwind.config` file

### Requirement: Organic tokens in the theme

`globals.css` SHALL declare the Organic design tokens from `storefront-design-system` (colors including neutral/accent/accent-2 ramps, fonts, spacing, radii, shadows) in `@theme` and `:root`, replacing the scaffold's default cream/terra/Inter palette. Components SHALL use these tokens and SHALL NOT hard-code a hex or font a token carries.

#### Scenario: Scaffold palette removed
- **WHEN** the bootstrap completes
- **THEN** no `--color-cream`, `--color-terra` or Inter font declaration remains

### Requirement: Self-hosted fonts

Caprasimo and Figtree SHALL be self-hosted (for example through `next/font`) with `font-display: swap` and exposed as `--font-heading` and `--font-body`, with no runtime request to Google Fonts.

#### Scenario: Network requests
- **WHEN** a page loads
- **THEN** no request goes to `fonts.googleapis.com` or `fonts.gstatic.com`

### Requirement: Product image handling

Product images SHALL render with `next/image` and `images.unoptimized: true` in `next.config.ts`, because the commercetools CDN rejects Next's optimizer parameters. Images SHALL use `fill` with `sizes`, and the above-the-fold image SHALL set `priority`.

#### Scenario: Optimizer disabled
- **WHEN** `next.config.ts` is reviewed
- **THEN** `images.unoptimized` is `true` and `remotePatterns` cover the image hosts in use
