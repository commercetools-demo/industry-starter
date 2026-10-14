<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream B: Design tokens and fonts (both kits, lint)

**Depends on:** A (both apps scaffolded, gate scripts present, `check-tokens` pass-through exists).
**Parallel with:** C, D. B and C both touch `app/layout.tsx`; B owns the `<html>` class and font wiring, C owns the `[locale]` layout. Do not edit each other's files except where this plan says so.
**Owner prerequisites:** none. No commercetools call.
**Branch:** `ws/b-design-tokens-and-fonts`. Commit per task: `ws-B: B-03 <summary>`.
**Skills:** `commercetools-storefront` (Next.js adapter, Tailwind v4 section of `project-layout.md`). No commercetools API is touched, so no `[SKILL:]` tags on tasks.

## 1. Goal

Both apps render only from design tokens:
- `storefront/` loads the automotive kit (Garage Maroon, Poppins, Archivo, Public Sans, Inter).
- `portal/` loads the admin kit (near-black action, Inter only, light and dark through `data-theme`, top bar dark in both themes).
- Tailwind v4 utilities resolve to CSS variables, so the theme adapter (workstream H) can override a variable and every surface follows.
- `check-tokens` fails any raw hex colour, raw font name, raw px size or Tailwind arbitrary value in source, names the token to use, and fails when the local token file drifts from the design source.

## 2. Specs and requirement ids implemented

Both are "token hooks" of the bootstrap specs; the primary owner is A. Cite these in commits.

`b2b2c-automotive/openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md`
- Requirement **Styling from the automotive tokens**, scenarios `No raw values` and `Tokens in sync`.
- Requirement **Directory structure** (the files `app/globals.css`, `app/tokens.css`).

`b2b2c-automotive/openspec/specs/seller-portal/bootstrap-and-structure/spec.md`
- Requirement **Styling from the admin kit**, scenarios `Dark mode` and `No raw values`.

Supporting (read, do not change): `consumer-storefront/theming-design/spec.md` requirements **Storefront renders only from semantic automotive tokens through an adapter** (the token names H overrides), **Locked tokens and unsupported theme fields** (status colours, spacing, widths stay fixed), **Fonts are loaded from an allow-list** (B delivers the registry H reads).

## 3. Design decisions already taken

| Decision | Source |
| --- | --- |
| Design tokens only in components; no raw hex, font or px | `design.md` section 4 decision 9; both specs |
| Storefront `app/tokens.css` is the copy of `design-systems/automotive/tokens.css` (identical to `design/export/tokens.automotive.css`; verified identical on 2026-10-12) | storefront spec "Styling from the automotive tokens" |
| Portal `app/tokens.css` is the copy of `design/export/tokens.admin.css` | portal spec "Directory structure" |
| Skill's placeholder palette (cream, charcoal, terra, sage) is not used | storefront spec "Styling from the automotive tokens" |
| Tokens exposed to Tailwind through `@theme inline` so the per-store adapter can override them | storefront spec same requirement |
| Portal: light and dark via `data-theme`, Inter only, top bar `--color-bg-topbar` dark in both themes; portal is not reseller-themed | portal spec "Styling from the admin kit"; `design.md` decision 8 |
| Locked tokens (status, fit, spacing, widths 1200/1440, focus ring width) are never theme-driven | theming-design "Locked tokens" |

Defaults chosen by this plan:
1. **The Google Fonts `@import url(...)` line (line 2 of both token files) is removed from the local copies and fonts are self-hosted through `next/font/google` at build time.** Reason: a runtime request to Google is a privacy problem for a DACH shop, and the font allow-list requirement says an unknown family loads "no external font". The sync check compares the local file with the source after removing that single `@import` line. This deviates from "byte-identical"; recorded as Q-B01.
2. Font variables: the tokens keep the literal family names (`"Poppins", system-ui, ...`). `app/globals.css` overrides the five `--font-*` tokens with `var(--font-poppins)` etc. (the CSS variables created by `next/font`) so that no raw family name appears outside tokens.
3. **Default Tailwind palette is removed** (`--color-*: initial` inside `@theme inline`), so `bg-red-500` or `text-white` cannot compile; only token-backed colours exist.
4. Px allowances in `check-tokens`: `1px` (hairlines), any px inside `@media`/`@container` conditions, `sizes="..."` attributes on images. Everything else with `px` is a violation.
5. Portal theme choice is stored in `localStorage` key `malva-portal-theme` (`light` | `dark`), default `light`, applied before first paint by an inline script. The toggle UI belongs to workstream R.
6. Dev-only specimen pages `app/dev/tokens/page.tsx` in both apps (outside `[locale]`, covered by `check-no-dev-pages`). C's proxy must skip `/dev` when `NODE_ENV !== 'production'` (C task C-06 says so).

## 4. Tasks

### B-01 Copy the token files and the sync check [SPEC: Styling from the automotive tokens; Tokens in sync]
1. Storefront: copy `../design-systems/automotive/tokens.css` (path relative to `b2b2c-automotive/`, i.e. `../../design-systems/automotive/tokens.css` from `storefront/`) to `storefront/app/tokens.css`, then delete line 2 (the `@import url("https://fonts.googleapis.com/...")`). Keep everything else byte for byte, including the header comment.
2. Portal: copy `../design/export/tokens.admin.css` to `portal/app/tokens.css`, delete its `@import url(...)` line.
3. Write `scripts/tokens-source.mjs` (identical in both apps, differences via `scripts/app.config.mjs`: add `TOKENS_SOURCE` = `'../../design-systems/automotive/tokens.css'` for storefront and `'../design/export/tokens.admin.css'` for portal). Export `normalise(css)` = remove lines matching `/^@import url\("https:\/\/fonts\.googleapis\.com[^\n]*\n/`, normalise `\r\n`, ensure one trailing newline. Export `diffTokens(local, source)` returning `string[]` (empty when equal; otherwise first 20 differing lines as `-`/`+`).
4. Test first `scripts/tokens-sync.test.mjs`: `Tokens in sync` (real files equal after normalising), `Tokens drift names the line` (change one hex in a temp copy; problem text includes the token name), `Google import is removed locally` (local file has no `fonts.googleapis.com`).

### B-02 Tailwind wiring with `@theme inline` [SPEC: Styling from the automotive tokens; Styling from the admin kit]
`app/globals.css` (storefront):
```css
@import 'tailwindcss';
@import './tokens.css';

/* fonts:begin (values come from next/font, see lib/fonts.ts) */
:root {
  --font-display: var(--font-poppins), system-ui, sans-serif;
  --font-body: var(--font-poppins), system-ui, sans-serif;
  --font-utility: var(--font-archivo), system-ui, sans-serif;
  --font-ui: var(--font-public-sans), system-ui, sans-serif;
  --font-button-alt: var(--font-inter), system-ui, sans-serif;
}
/* fonts:end */

@theme inline {
  --color-*: initial;            /* remove the default Tailwind palette */
  /* one line per token in tokens.css, same name, value var(--same-name):  */
  --color-brand-50: var(--color-brand-50);   /* ... brand 50-950, brand-deep */
  /* accent 50-900, neutral 0-1000, success/danger/warning/info shades,   */
  /* and every semantic colour: text*, surface*, border*, action*, focus, rating */
  --font-display: var(--font-display);       /* display, body, utility, ui, button-alt */
  --text-xs: var(--text-xs);                 /* xs..5xl; leading via --text-xs--line-height not set (use leading-tight/normal) */
  --leading-tight: var(--leading-tight);
  --leading-normal: var(--leading-normal);
  --tracking-label: var(--tracking-label);
  --spacing-1: var(--space-1);               /* 1..9 -> p-1 = 4px ... p-9 = 96px (p-5 is 24px, not Tailwind's 20px) */
  --radius-xs: var(--radius-xs);             /* xs, sm, md, lg, xl, pill, full */
  --shadow-hairline: var(--shadow-hairline); /* hairline, card, dropdown */
  --container-content: var(--content-width);
  --container-page: var(--container-width);
}

body { background: var(--color-surface-page); color: var(--color-text); font-family: var(--font-body); }
```
Writing the one-line-per-token block by hand invites drift, so generate it: `scripts/gen-theme-block.mjs` reads `app/tokens.css` and prints the `@theme inline` body between markers `/* theme:begin */` and `/* theme:end */` in `globals.css`; `check-tokens` runs the generator in `--check` mode and fails when the block is stale. (Same-name self-reference is safe: in `inline` mode Tailwind emits utilities such as `.bg-brand-700{background-color:var(--color-brand-700)}` and does not emit a second `--color-brand-700` declaration. Verify this in the test below.)

Portal `globals.css`: same structure, token families of the admin kit: colours (`--color-bg-*`, `--color-text*`, `--color-border*`, `--color-chart-*`, `--color-overlay`, and primitive ramps gray, blue, green, azure, purple, red, orange, yellow), `--font-sans: var(--font-inter), system-ui, sans-serif;` (and `--font-mono`, `--font-chart` kept as in tokens), type scale as `--text-h1` ... with `--text-h1--line-height: var(--leading-h1)` and `--text-h1--letter-spacing: var(--tracking-h1)`, weights `--font-weight-medium: var(--weight-medium)` etc., spacing `--spacing-100: var(--space-100)` (so `p-100` = 4px, `p-400` = 16px), radius `--radius-100` ... `--radius-full`, shadows, `--container-page-desktop`, plus `--sidebar-width`, `--topbar-height`. `body { background: var(--color-bg-page); color: var(--color-text); font-family: var(--font-sans); }`.

Test first `scripts/tailwind-tokens.test.mjs` (compile with `import { compile } from '@tailwindcss/node'`, `base` = app root, then `.build([...candidates])`):
- `Utilities resolve to CSS variables`: candidates `bg-brand-700`, `text-text`, `p-4`, `rounded-md`, `font-display`, `shadow-card`, `text-lg` (storefront); `bg-bg-surface`, `text-text`, `p-400`, `rounded-300`, `font-sans`, `text-h1` (portal). Expect output contains the matching `var(--...)` and does **not** contain a raw hex.
- `Default palette is gone`: candidates `bg-red-500`, `text-white` produce no rule.
- `Theme block is current`: generator output equals the committed block.

### B-03 Fonts with `next/font/google` [SPEC: token hooks; supports "Fonts are loaded from an allow-list"]
1. `lib/fonts-registry.ts` (pure data, no `next/font` import, safe in tests and in H's allow-list):
```ts
export interface FontEntry { family: string; cssVar: string; }
export const FONT_REGISTRY: readonly FontEntry[] = [
  { family: 'Poppins', cssVar: '--font-poppins' },
  { family: 'Archivo', cssVar: '--font-archivo' },
  { family: 'Public Sans', cssVar: '--font-public-sans' },
  { family: 'Inter', cssVar: '--font-inter' },
];
```
(portal: only `Inter`.)
2. `lib/fonts.ts` (imported only by `app/layout.tsx`):
```ts
import { Poppins, Archivo, Public_Sans, Inter } from 'next/font/google';
export const poppins = Poppins({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-poppins', display: 'swap' });
export const archivo = Archivo({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-archivo', display: 'swap' });
export const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-public-sans', display: 'swap' });
export const inter = Inter({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-inter', display: 'swap' });
export const fontClassNames = [poppins, archivo, publicSans, inter].map((f) => f.variable).join(' ');
```
Portal: Inter with weights `['400','500','600','700']` only. Weights match the removed `@import` (Archivo 400/500/700, Inter 400/500/600, Poppins 400-700, Public Sans 400-700; portal Inter 400-700).
3. `app/layout.tsx`: import `./globals.css`, put `fontClassNames` on `<html>`. Portal also `suppressHydrationWarning` on `<html>` and the theme script (B-05).
4. If `next build` cannot reach Google Fonts (sandbox, CI without internet), do not hard-code a workaround: install `@fontsource/poppins @fontsource/archivo @fontsource/public-sans @fontsource/inter` and swap the four `next/font/google` calls for `next/font/local` pointing at the woff2 files under `node_modules/@fontsource/<name>/files/`, same `variable` names. Keep `FONT_REGISTRY` unchanged. Note the swap in the PR.
5. Test first `lib/fonts-registry.test.ts`: `Registry lists exactly the approved families` (storefront: four names; portal: Inter), `Every registry variable has a font-variable override in globals.css` (read `globals.css`, expect `var(--font-poppins)` etc. present; portal: `var(--font-inter)`).

### B-04 `check-tokens.mjs` full implementation [SPEC: No raw values; Tokens in sync; Dark mode (topbar rule)]
Replace the pass-through. Port structure from `b2b-manufacturing/site/scripts/check-tokens.mjs` (read it; keep `rootBlock`, `tokenMap`, `lintSource` shapes) and extend. Export `lintSource(file, text, tokenMap)` returning `string[]`, and `checkTokens(root)`.
Scope: `app/**`, `components/**`, `lib/**` (`.ts`, `.tsx`, `.css`), excluding `app/tokens.css`, the `fonts:` and `theme:` blocks of `app/globals.css`, `*.test.*`, `**/opengraph-image.tsx`, `lib/theme/default-theme.ts` (H, Contentools values are raw by nature), `app/dev/**` is **not** excluded (specimen pages use `var()` only).
Violations (each message names the token to use; nearest token by colour distance in sRGB, or by exact px value for sizes):
1. Raw colour: hex `#rgb|#rgba|#rrggbb|#rrggbbaa`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`. Message `raw colour #821810; use var(--color-brand-700)`.
2. Raw font: `font-family:` or `fontFamily:` whose value is not `var(...)`, `inherit`, `system-ui`; Tailwind `font-[`...`]`. Message `font "Poppins" is not allowed here; use var(--font-display)`. In the portal also fails on any family other than Inter.
3. Raw px: `\b\d+(\.\d+)?px\b` except the allowances in section 3 default 4. Message `raw size 14px; use var(--text-sm)` (storefront) or `var(--text-body-2)` (portal), choosing by property name (`font-size` to text tokens, `padding|margin|gap` to space tokens, `border-radius` to radius tokens; otherwise list the three nearest).
4. Tailwind arbitrary values: `\[#`, `\[\d+px\]`, `\[rgb`; and Tailwind default palette class names `(bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?` (storefront: `neutral-N` is a real token and is allowed; `gray` etc. are errors; portal: `gray-N`, `blue-N`, ... are real tokens and allowed, `white|black|slate|zinc|...` are errors).
5. Unknown variable: every `var(--x)` must exist in `tokens.css`, in the font variables `--font-poppins|archivo|public-sans|inter`, or in `scripts/token-allowlist.json` (empty array at the start; H adds `--store-*` helpers).
Repo-level checks in `checkTokens(root)`:
6. Tokens in sync (B-01).
7. Theme block current (B-02).
8. Portal only: the `[data-theme="dark"]` block of `app/tokens.css` does not define `--color-bg-topbar`.
9. Storefront only: no occurrence of `cream`, `charcoal`, `terra`, `sage` as token names.
Tests (`scripts/check-tokens.test.mjs`), one per scenario, with fixture strings:
- `No raw values: hex` (message contains `var(--color-brand-700)` for `#821810` in the storefront), `No raw values: font name`, `No raw values: px size`, `Arbitrary Tailwind value is rejected`, `Default palette class is rejected`, `Hairline 1px is allowed`, `px inside a media query is allowed`, `Unknown variable is rejected`, `Tokens in sync` and `Theme block is current` through `checkTokens` on the real app, `Dark top bar` (portal; fails on a temp copy that adds `--color-bg-topbar` to the dark block), `Placeholder palette is rejected`.

### B-05 Portal theme attribute and no-flash script [SPEC: Styling from the admin kit; Dark mode]
`portal/lib/theme-init.ts`: `export const THEME_STORAGE_KEY = 'malva-portal-theme'; export const themeInitScript = \`(()=>{try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})()\`;`. In `app/layout.tsx` `<head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>`; `<html lang="de-DE" data-theme="light" suppressHydrationWarning>`. Tests (`lib/theme-init.test.ts`): `Stored dark applies data-theme dark` (eval the script in jsdom), `Invalid value falls back to light`, `Storage unavailable falls back to light`.

### B-06 Specimen pages and component-level tests [SPEC: Dark mode; No raw values]
1. `lib/dev/token-list.ts` (server only, dev): reads `app/tokens.css` with `fs` and returns `{ colors: string[]; fonts: string[]; spaces: string[]; radii: string[]; shadows: string[] }` using the same `tokenMap`.
2. `app/dev/tokens/page.tsx` (both apps): a server component that renders sections with `data-testid="swatch-<token>"`: each colour token as a box whose `style={{ background: 'var(--<token>)' }}`, a type specimen for each font token with the sentence "Brake pads for a 2019 Golf" (portal: "Quarterly purchase orders"), spaces as bars, radii as boxes, shadows as cards. Portal also renders a mock top bar with `className="bg-bg-topbar text-text-on"` and a surface card `bg-bg-surface`, plus a button `data-testid="toggle-theme"` (client component `components/dev/ThemeToggleDev.tsx`, sets `data-theme` and localStorage) for the dark check. Page export `metadata.robots = { index: false }`.
3. Tests `app/dev/tokens/page.test.tsx`: `Specimen lists every colour token` (render the async server component via `await Page()` then `render`, compare `data-testid` set with `token-list`), `Specimen uses var() only` (no `style` attribute value contains `#` or `rgb`), portal: `Top bar uses the topbar token`, `Toggle sets data-theme` (userEvent click then `document.documentElement.dataset.theme === 'dark'`), `Specimen has no accessibility violations` (jest-axe; exclude colour-contrast rule in jsdom).

### B-07 Wire into `npm run check` and dry run
`check-tokens` and `check-messages` are already in `npm run check` (A-09). Confirm `npm run check && npm run verify:build` in both apps. Add one line to each README: "Components use tokens only; see `scripts/check-tokens.mjs`."

## 5. Test-first scenarios (unit and component tests)

| Test name | File | Spec scenario |
| --- | --- | --- |
| `Tokens in sync`, `Tokens drift names the line`, `Google import is removed locally` | `scripts/tokens-sync.test.mjs` | Tokens in sync (storefront) |
| `Utilities resolve to CSS variables`, `Default palette is gone`, `Theme block is current` | `scripts/tailwind-tokens.test.mjs` | Styling from the automotive tokens; Styling from the admin kit |
| `No raw values: hex / font name / px size`, `Arbitrary Tailwind value is rejected`, `Default palette class is rejected`, `Unknown variable is rejected`, `Placeholder palette is rejected` | `scripts/check-tokens.test.mjs` | No raw values (both specs) |
| `Dark top bar` | `scripts/check-tokens.test.mjs` (portal) | Dark mode |
| `Registry lists exactly the approved families`, `Every registry variable has a font-variable override in globals.css` | `lib/fonts-registry.test.ts` | supports Fonts allow-list |
| `Stored dark applies data-theme dark`, `Invalid value falls back to light`, `Storage unavailable falls back to light` | `lib/theme-init.test.ts` | Dark mode |
| `Specimen lists every colour token`, `Specimen uses var() only`, `Top bar uses the topbar token`, `Toggle sets data-theme`, `Specimen has no accessibility violations` | `app/dev/tokens/page.test.tsx` | Dark mode; No raw values |

## 6. Browser verification recipe (Chrome DevTools MCP, run by Claude)

Storefront (`npm run dev`, port 3000), URL `http://localhost:3000/dev/tokens` (requires C's proxy `/dev` skip once C has landed; before C there is no proxy):
1. `navigate_page` to the URL; `resize_page` 1440x900; `take_screenshot` -> `plans/evidence/B/storefront-tokens-1440.png`; resize 375x800 -> `storefront-tokens-375.png`.
2. `evaluate_script`: `getComputedStyle(document.documentElement).getPropertyValue('--color-brand-700').trim()` must equal `#821810`; `--color-surface-utility` equals `var(--color-neutral-1000)`'s resolved colour (`getComputedStyle(document.querySelector('[data-testid="swatch-color-surface-utility"]')).backgroundColor === 'rgb(0, 0, 0)'`).
3. Fonts: `evaluate_script` returning `[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)`; after scrolling to the type specimen the list must contain entries for Poppins, Archivo, Public Sans (the names `next/font` generates contain the family). `list_network_requests`: no request to `fonts.googleapis.com` or `fonts.gstatic.com` (fonts are served from `/_next/static/media`).
4. `get_css_styles` on `[data-testid="font-display"]` -> `font-family` begins with the generated Poppins family. `list_console_messages`: no errors.
5. Tailwind check: `evaluate_script` that `getComputedStyle(document.querySelector('[data-testid="btn-sample"]')).backgroundColor === 'rgb(130, 24, 16)'` (a button using `bg-action`).

Portal (`PORT=3001 npm run dev`), URL `http://localhost:3001/dev/tokens`:
1. Light: `take_screenshot` -> `plans/evidence/B/portal-tokens-light-1440.png`; `--color-bg-page` computed `#f7f7f7`; top bar mock `backgroundColor` `rgb(48, 48, 48)`.
2. `click` the `toggle-theme` button. Assert `document.documentElement.dataset.theme === 'dark'`, `--color-bg-page` is `#1a1a1a`, surface card background `rgb(48, 48, 48)`, top bar mock **still** `rgb(48, 48, 48)`. Screenshot -> `portal-tokens-dark-1440.png`; 375 px light -> `portal-tokens-light-375.png`.
3. Reload: theme persists (`localStorage['malva-portal-theme'] === 'dark'`), and the first paint has `data-theme="dark"` (`evaluate_script` right after `navigate_page` with `wait_for` disabled is not reliable; instead check `document.documentElement.dataset.theme` before hydration with the unit test and here just after load).
4. Fonts: only Inter faces loaded; no external font requests; console clean.

## 7. Project-data checks (MCP `b2b2c-automotive`)
None.

## 8. Manual items for `plans/TODO-MANUAL-TESTING.md`
Add under section 3 (never wait on it; continue with C):
| ID | Workstream | What to do | Expected | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| M-B-1 | B | 1) Open `plans/evidence/B/storefront-tokens-1440.png` and `portal-tokens-light-1440.png` / `portal-tokens-dark-1440.png`. 2) Compare with `design-systems/automotive/foundations/colors.html`, `typography.html` and `design/export/admin-design-system.README.md` principles. | Colours, type families and the dark top bar read as the kits intend | B done | TODO |

## 9. Definition of done
- `npm run check` and `npm run verify:build` green in both apps; `check-tokens` is the full version, not the pass-through.
- A deliberate raw hex in a component makes `npm run check` fail naming the token (try it, then revert; paste the message in the PR).
- Local token files differ from their sources only by the removed `@import` line (`diff` output in the PR).
- `lib/fonts-registry.ts` exists in both apps (H and the portal theme work import it).
- M-B-1 row exists. Q-B01 is in `plans/notes/questions-ABCGH.md`.

## 10. Evidence to record
`plans/evidence/B/`: the five screenshots above (`storefront-tokens-1440.png`, `storefront-tokens-375.png`, `portal-tokens-light-1440.png`, `portal-tokens-dark-1440.png`, `portal-tokens-light-375.png`), `check-tokens-fail.txt` (message from the deliberate raw hex), `tokens-diff-storefront.txt`, `tokens-diff-portal.txt`, `network-fonts.txt` (the filtered request list showing no Google host).

## Progress

Storefront (J2). Portal tasks are tracked by the portal junior.

- B-01 storefront: done (`app/tokens.css`, `scripts/tokens-source.mjs`, source is `../design/export/tokens.automotive.css`, identical to `design-systems/automotive/tokens.css`)
- B-02 storefront: done (generated `@theme inline` block; note Tailwind still emits the same-name aliases inside `@layer theme`, harmless because `tokens.css` is unlayered and wins; tested)
- B-03 storefront: done (`next/font/google` fetched fonts at build, no `@fontsource` swap needed)
- B-04 storefront: done (all 9 rules; deliberate raw hex message in `plans/evidence/B/check-tokens-fail.txt`)
- B-05 storefront: n/a (portal only)
- B-06 storefront: done (`/dev/tokens`, `lib/dev/token-list.ts`, tests; no portal toggle)
- B-07 storefront: partial (`npm run check` and `verify:build` green; fresh-clone dry run left to the lead). Evidence in `plans/evidence/B/`: `storefront-tokens-1440.png`, `storefront-tokens-375.png`, `check-tokens-fail.txt`, `tokens-diff-storefront.txt`, `network-fonts.txt`. M-B-1 row already exists. Q-B01 already exists.

Portal (J3):
- B-01 portal: done (`app/tokens.css` is the admin tokens minus the Google `@import`; `tokens-source.mjs`, `tokens-sync.test.mjs`; diff in `plans/evidence/B/tokens-diff-portal.txt`)
- B-02 portal: done (`@theme inline` block generated by `scripts/gen-theme-block.mjs`; default scales for colour, font, text, radius, shadow, spacing and container removed; self-reference verified: no second variable declaration is emitted; `tailwind-tokens.test.mjs`)
- B-03 portal: done (`lib/fonts-registry.ts`, `lib/fonts.ts` with Inter 400-700; `next/font/google` worked at build, no `@fontsource` swap)
- B-04 portal: done (rules 1 to 8; rule 9 and the placeholder palette test are storefront only; deliberate failures in `plans/evidence/B/portal-check-tokens-fail.txt`)
- B-05 portal: done (`lib/theme-init.ts`, root layout script, 4 tests)
- B-06 portal: done (`app/dev/tokens/page.dev.tsx` named `.dev.tsx` so production builds exclude it, Q-J3-02; `components/dev/ThemeToggleDev.tsx`, `lib/dev/token-list.ts`, 5 tests)
- B-07 portal: partial (`npm run check` and `verify:build` green; fresh-clone dry run left to the lead). Browser recipe run on port 3100: light and dark computed values as the recipe expects, top bar stays `rgb(48, 48, 48)`, theme persists after reload, only Inter faces, no Google host, no console errors. Evidence: `plans/evidence/B/portal-*`, `portal-README.md`. Reload "first paint" is covered by the unit test of the init script.
