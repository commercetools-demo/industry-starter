<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream H: Contentools integration and theme adapter (storefront)

**Depends on:** B (token files, `lib/fonts-registry.ts`, `check-tokens`), G (`lib/ttl-cache.ts`, `lib/env.ts`, proxy with the `x-store-key` header, `lib/session.ts`).
**Parallel with:** F (seed 3).
**Owner prerequisites:** **OA-02** (the `multitenant contentools` Merchant Center app installed and Connect clicked, so the JWT custom object exists). All offline tasks (H-01 to H-09) need nothing; the live tasks (H-10, section 6) need OA-02. If OA-02 is not `DONE` when you reach H-10, add the rows in section 8, finish the offline tasks, set the workstream to `Ready for review (live checks pending)` and tell Claude. Do not wait silently.
**Branch:** `ws/h-contentools-and-theme`. Commit per task: `ws-H: H-04 <summary>`.
**Skills:** `commercetools-storefront` (Next.js adapter, `best-practices/server-components.md`, `metadata.md` for `cache()`), `commercetools-platform` (custom objects, key rules), `commercetools-connect` (Contentools can deploy as a Connect service; read only, nothing is deployed here). Plus `/Users/behnam/code/b2b2c-starter/.claude/skills/integrate-contentools/SKILL.md` (read it fully first).

## 1. Goal

The storefront reads **only the theme** and published Puck pages from Contentools, and turns the theme into the automotive tokens at first paint:
1. `lib/contentools/*`: origin module, published-page read, theme read (TTL cache, last-good fallback, timeout).
2. `lib/theme/*`: sanitiser, colour maths, ramp derivation, font allow-list, token adapter, built-in default theme.
3. Root layout injects `<style id="store-theme">` in the head after the token CSS.
4. `app/api/contentools/[...path]/route.ts`: read-only same-origin proxy with an allow-list.
5. `components/contentools/ContentoolsPage.tsx`: client renderer with fallback children.
6. A dev publish script and QA fixtures so Claude can show two store themes, the `default` fallback and a hostile value end to end.

The portal half of Contentools (JWT resolution, hardened write proxy, manager wrapper) is **not** here: it is workstreams U and X. H does not touch `portal/`.

## 2. Specs and requirement ids implemented (primary owner)

`b2b2c-automotive/openspec/specs/consumer-storefront/theming-design/spec.md`
- **One theme per reseller store, resolved by the store key** (scenarios `Branches share the store theme`, `No theme saved`)
- **Storefront renders only from semantic automotive tokens through an adapter** (scenarios `Token change reaches every surface`, `Raw values are rejected at review`)
- **Locked tokens and unsupported theme fields** (scenarios `Reseller picks a glass preset`, `Fit colours do not follow the theme`)
- **Fonts are loaded from an allow-list** (scenario `Unknown family`)
- **Header and footer are application components** (adapter side only: the adapter never touches structure; the components are workstream I)
- **External theme values are sanitised and applied at first paint** (scenario `Hostile value`)
- **Theme changes apply predictably** (scenario `Contentools unavailable`)

`b2b2c-automotive/openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md` (shared with A and G; H delivers the Contentools parts)
- **Contentools reads and the same-origin proxy** (scenarios `Published page`, `No page`, `createContext footgun`, `Write through the storefront proxy`)
- **Theme read, sanitised, applied at first paint** (scenario `Hostile value`)

## 3. Design decisions already taken

| Decision | Source |
| --- | --- |
| Theme is stored in Contentools as a commercetools custom object, container `configuration`, key `{storeKey}-theme`; read with `GET {origin}/service/{storeKey}/configuration/theme` and header `x-project-key`; no user token; a store without theme gets the `default` namespace's theme | theming-design "How Contentools stores and serves the theme"; verified in `/Users/behnam/code/cms/service/src/routes/configuration.route.ts` and `controllers/configuration.controller.ts` (`getTheme` falls back to `DEFAULT_BUSINESS_UNIT_KEY = 'default'`; keys built as `${businessUnitKey}-theme`) |
| The storefront reads nothing else from Contentools configuration (`header`, `footer`, `facet`, `site-metadata`, `category-listing`, `translations`) | `design.md` section 2 "Only the theme" |
| `default` namespace holds the Malva automotive theme | `design.md` section 2 "Tenancy"; theming-design requirement 1 |
| Published page: `POST {origin}/service/{storeKey}/published/puck-pages/query`, header `x-project-key`, body `{ query: 'slug = "<slug>"' }`, plain `fetch` in a Server Component, `import type { PuckData }` only, React `cache()` | storefront spec; skill; verified in `puck-page.route.ts` (404 when not published, response holds `puckData`) |
| Render in a client component with `PuckApiProvider` and `PuckDataRenderer`; fallback children when no page | storefront spec |
| Proxy: `CONTENTOOLS_PROXY_BASE = '/api/contentools/service'`; injects `x-project-key` (= `CTP_PROJECT_KEY`); deletes `host`; strips `content-encoding`, `content-length`, `transfer-encoding`, `connection` from responses; body only for non-GET/HEAD; `redirect: 'manual'`; storefront holds no JWT; only GET and the published-page query POST pass, everything else is 404 | storefront spec |
| Theme is sanitised against a safe-CSS pattern, applied as inline `<style id="store-theme">` in the root layout head after the `@theme` defaults; short TTL; falls back to last cached theme, then built-in default | theming-design; storefront spec |
| Mapping table `ThemeTokens` to automotive tokens; locked tokens; ignored fields; fonts allow-list (Poppins, Archivo, Inter, Public Sans plus approved additions), other families give `system-ui` | theming-design tables and requirements |
| No contrast checking | `design.md` decision 2 |
| Header, footer, disclaimer, legal links are never Puck-editable | theming-design "Header and footer..." |

Defaults chosen by this plan (specs silent; see questions):
1. **Override only what differs from the default theme.** `buildThemeVars(theme)` computes the variable set for the given theme and for `MALVA_DEFAULT_THEME` and emits only the variables whose value differs. So the default theme emits an empty block and the kit's literal tokens (including Archivo for utility text and Public Sans for forms) are exactly what the design shows. A reseller who changes only `colorPrimary` gets only the brand ramp.
2. **Brand colour flows through the token chain.** The adapter overrides the `--color-brand-*` ramp (700 = `colorPrimary`, 600 = `colorPrimaryHover`); `--color-action`, `--color-text-link`, `--color-text-price`, `--color-focus`, `--color-border-brand` follow through the `var()` chain already in `tokens.css`. The adapter also emits them explicitly (`--color-action: var(--color-brand-700)` and so on) so a later change to `tokens.css` cannot silently break theming; a test asserts the chain.
3. Selector is `:root:root { ... }` (specificity higher than `:root` of `tokens.css`), so order of CSS files cannot defeat it.
4. Theme TTL 60 seconds (`THEME_TTL_SECONDS` constant, in-memory per server instance, reusing G's `createTtlCache`); a failed fetch serves the last good value for that store, then `null`. Request timeout 2 seconds. A missing theme (404 or `null`) is cached for the same 60 seconds.
5. Home slug constant `HOME_SLUG = '/home'` (the reference starter and Contentools example body use `slug = "/home"`).
6. `defaultPuckConfig` (`puck-editor`) is what the spec names; the reference starter's published renderer package exports `defaultRenderConfig` from `@commercetools-demo/puck-renderer`. Use whichever the installed `puck-renderer` version exports for `PuckDataRenderer` (check with `grep -E "defaultRenderConfig|defaultPuckConfig" node_modules/@commercetools-demo/puck-renderer/dist/*.d.ts node_modules/@commercetools-demo/puck-editor/dist/*.d.ts`), prefer `defaultRenderConfig`, and write the choice in the PR.
7. SSR first: render `ContentoolsPage` with SSR (a normal `'use client'` component is still server-rendered), which is what the `Published page` scenario needs. The reference starter switched to `dynamic(..., { ssr: false })` because the renderer sanitises HTML with `isomorphic-dompurify` which pulls in `jsdom`, which Netlify's bundler could not trace. H-08 contains a spike; if SSR fails there, use the client-only fallback. **Owner answer (Q-H02, binding): the client-only fallback is allowed**, so no owner acknowledgement is needed: mark the SSR assertion `Published page is in the initial HTML` as waived in the PR, record the reason in `plans/evidence/H/spike-ssr.md`, and keep the fetch of the page JSON on the server.
8. The inbound request header `x-store-key` is deleted by `proxy.ts` on every path except `/dev` outside production, so a visitor cannot choose a theme by header.
9. Contentools Merchant Center app and Connect are an operator step (OA-02); the storefront never holds the JWT, so H never reads the JWT custom object; only the publish script (a developer tool, section 4 H-10) does.

## 4. Tasks

All paths are under `b2b2c-automotive/storefront/`. Write the test first for each task.

### H-01 Origin module [SKILL: commercetools-platform] [SPEC: Contentools reads and the same-origin proxy]
`lib/contentools/origin.ts` (no `server-only`; imported by client code for the proxy base):
```ts
export const CONTENTOOLS_ORIGIN = (process.env.CONTENTOOLS_ORIGIN ?? '').replace(/\/+$/, '');
export const CONTENTOOLS_PROXY_BASE = '/api/contentools/service';
```
No default URL (G's `validateEnv` makes the variable mandatory). Add a lint check in `check-server-only` that `CONTENTOOLS_ORIGIN` or `process.env.CONTENTOOLS_ORIGIN` appears in **no other file** (`origin.ts` is the only reader) and a test.
Tests (`lib/contentools/origin.test.ts`, reset modules between cases): `Trailing slash is trimmed`, `Several trailing slashes are trimmed`, `Proxy base is fixed`, `Only origin.ts reads the variable`.

### H-02 Published page read [SKILL: commercetools-platform] [SPEC: Published page; No page; createContext footgun]
`lib/contentools/puck.ts` (`import 'server-only'`, `import type { PuckData } from '@commercetools-demo/puck-types'` only):
```ts
export const HOME_SLUG = '/home';
export const getPublishedPage: (storeKey: string, slug?: string) => Promise<PuckData | null>; // React cache()
```
Behaviour: validate `storeKey` with `/^[A-Za-z0-9_-]{2,256}$/` and `slug` with `/^\/[a-z0-9][a-z0-9/_-]*$/i` (reject anything with a quote, backslash or whitespace, because the slug goes into a Contentools query string), else return `null` without a request. `POST ${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(storeKey)}/published/puck-pages/query`, headers `Content-Type: application/json` and `x-project-key: <CTP_PROJECT_KEY>`, body `JSON.stringify({ query: \`slug = "${slug}"\` })`, `next: { revalidate: 30 }`, `signal: AbortSignal.timeout(2000)`. Not ok (404 means no published page), thrown error, or `puckData.content` not a non-empty array: `null`.
Tests (`lib/contentools/puck.test.ts`, mock `fetch` with `vi.stubGlobal`): `Published page returns puckData`, `404 returns null`, `Network error returns null`, `Empty content returns null`, `Request shape` (URL, headers, body), `Store key is encoded`, `Slug with a quote is rejected without a request`, `Invalid store key is rejected without a request`, `Same arguments hit fetch once per request` (React `cache` in a test: call within `cache` scope is awkward, so assert only that the exported function is created with `cache`: check `getPublishedPage.length`-free approach, or skip with a comment; do not add `it.skip`; instead test that two sequential awaits of different slugs both call fetch).

### H-03 Safe values and colour maths [SPEC: Hostile value; Fonts allow-list]
`lib/theme/color.ts` (pure):
```ts
export interface Rgb { r: number; g: number; b: number }              // 0..255
export const SAFE_CSS_VALUE = /^[A-Za-z0-9#(),.%\s_-]{1,200}$/;       // first gate for any raw theme string
export function parseColour(raw: unknown): Rgb | null;                // hex 3/4/6/8 digits, rgb()/rgba(), hsl()/hsla(); everything else null; alpha is dropped
export function toHex(c: Rgb): string;                                // '#rrggbb' lowercase
export function rgbToHsl(c: Rgb): { h: number; s: number; l: number }; // h 0..360, s and l 0..100
export function hslToRgb(h: number, s: number, l: number): Rgb;
```
`parseColour` first requires `SAFE_CSS_VALUE`, then parses with strict regexes (numbers only). Named colours (`red`) are not accepted (returns null, the caller uses the default). Output of the adapter is always built from `toHex`, never from the input string, which is why no input text can reach the stylesheet.
Tests (`lib/theme/color.test.ts`): `Hex 3, 4, 6 and 8 digits parse`, `rgb and rgba parse`, `hsl parses`, `Named colour is rejected`, `Hostile string is rejected` (`;}</style><script>`), `url(...) is rejected`, `Expression is rejected`, `Round trip hex to hsl to hex stays within 1 per channel`, `toHex is lowercase six digits`.

### H-04 Ramps [SPEC: Storefront renders only from semantic automotive tokens (derived ramps)]
`lib/theme/ramp.ts`:
```ts
export type Stop = 50|100|200|300|400|500|600|700|800|900|950;
export function brandRamp(primary: Rgb, hover?: Rgb): Record<Stop, string>;   // hex per stop; 700 is exactly the primary; 600 is `hover` when given
export function accentRamp(accent: Rgb): Record<'50'|'100'|'200'|'300'|'400'|'500'|'600'|'700'|'800'|'900', string>; // 500 is exactly the accent
```
Algorithm (HSL of the base colour, `L` in percent, hue kept, saturation `S`):
- Brand lightness deltas from the primary's `L`: 50 +66, 100 +58, 200 +47, 300 +37, 400 +25, 500 +12, 600 +4, 700 0, 800 -7, 900 -11, 950 -17. Saturation: `S` for stops 200 to 950; `S * 0.85` for 50 and 100. Clamp `L` to 4..97, then force strictly decreasing lightness from 50 to 950 with a minimum step of 1.5 (push the neighbour away). `brand-deep` is the 800 stop (the adapter uses it).
- Accent deltas from the accent's `L` (base is stop 500): 50 +40, 100 +34, 200 +25, 300 +16, 400 +7, 500 0, 600 -1, 700 -22, 800 -29, 900 -37, same clamps and monotonic rule.
These deltas were fitted to the design's Garage Maroon `#821810` and Chrome Gold `#d1a04a` ramps. If a stop misses a tolerance below, adjust the delta table, never the tolerance.
Tests (`lib/theme/ramp.test.ts`): `Brand 700 is exactly the primary`, `Hover colour becomes stop 600`, `Brand ramp is monotonic for dark, mid and light primaries` (`#821810`, `#1f6f43`, `#f2c94c`), `Brand ramp of Garage Maroon is within tolerance of the design` (fixture: 50 `#fcefee`, 100 `#f7d6d3`, 200 `#eeaea9`, 300 `#e2807a`, 400 `#d34440`, 500 `#b02a22`, 600 `#911c14`, 800 `#6d0115`, 900 `#551205`, 950 `#3a0c03`; assert lightness within 4 points and hue within 15 degrees of each), `Accent 500 is exactly the accent`, `Accent ramp of Chrome Gold is within tolerance` (50 `#fff8e8`, 100 `#fdeccb`, 200 `#f9dc9f`, 300 `#f5cb73`, 400 `#e0b867`, 700 `#8c5c1b`, 800 `#6b4514`, 900 `#4a2f0e`), `Black and white primaries still give a valid monotonic ramp`.

### H-05 Fonts allow-list [SPEC: Fonts are loaded from an allow-list]
`lib/theme/fonts.ts` (imports `FONT_REGISTRY` from B's `lib/fonts-registry.ts`, never `next/font`):
```ts
export function firstFamily(raw: unknown): string | null;        // 'Inter, system-ui, sans-serif' -> 'Inter'; '"Public Sans", x' -> 'Public Sans'; unsafe or empty -> null
export function resolveFontStack(raw: unknown): string;          // allowed: `var(<cssVar>), system-ui, sans-serif`; otherwise `system-ui, sans-serif`
export function isAllowedFamily(name: string): boolean;          // case-insensitive match on FONT_REGISTRY
```
`firstFamily` rejects any value failing `SAFE_CSS_VALUE` (so quotes inside are only stripped at the ends). The allow-list is exactly the registry: Poppins, Archivo, Inter, Public Sans (adding a family means adding it to B's registry and `lib/fonts.ts`, which loads it; see Q-H03).
Tests (`lib/theme/fonts.test.ts`): `Unknown family`, `Quoted family with a space`, `Case-insensitive match`, `Generic stack falls back to system-ui` (`sans-serif` alone), `Hostile family is rejected`, `Empty value falls back`, `Allowed family maps to its CSS variable`.

### H-06 Theme adapter and default theme [SPEC: Storefront renders only from semantic automotive tokens; Locked tokens; Hostile value; Reseller picks a glass preset; Fit colours do not follow the theme]
1. `lib/theme/default-theme.json` (single source of truth; also published to the `default` namespace by H-10) and `lib/theme/default-theme.ts` (`export const MALVA_DEFAULT_THEME: ThemeTokens = defaultThemeJson`). JSON content:
```json
{
  "colorPrimary": "#821810", "colorPrimaryHover": "#911c14", "colorPrimaryForeground": "#ffffff",
  "colorSecondary": "#000000", "colorSecondaryForeground": "#ffffff",
  "colorBackground": "#fdfdfd", "colorSurface": "#ffffff",
  "colorText": "#191c1f", "colorTextMuted": "#475156",
  "colorAccent": "#d1a04a", "colorBorder": "#e4e7e9",
  "borderRadius": "md", "borderWidth": "1",
  "fontFamily": "Poppins, system-ui, sans-serif", "fontHeading": "Poppins, system-ui, sans-serif",
  "fontWeightBase": "400", "fontWeightHeading": "600",
  "spacingScale": 1, "buttonStyle": "solid", "cardShadow": "sm", "headerStyle": "solid"
}
```
2. `lib/theme/types.ts`: `import type { ThemeTokens } from '@commercetools-demo/puck-types'`. If the installed package does not export that type (`grep -r ThemeTokens node_modules/@commercetools-demo/puck-types/dist`), copy the interface from `/Users/behnam/code/cms/puck/packages/puck-types/src/theme-types.ts` into this file and add a comment with the source path.
3. `lib/theme/shadows.ts`: card shadow table, `none` = `none`, `sm` = the design's `0 0 10px rgba(0,0,0,.05)`, `md` = `0 4px 12px rgba(0,0,0,.08)`, `lg` = `0 8px 24px rgba(0,0,0,.12)`. Add `lib/theme/default-theme.json`, `lib/theme/shadows.ts` and `lib/theme/color.ts` to the exempt list of `scripts/check-tokens.mjs` (raw values are their purpose) with a test that they are the only exemptions inside `lib/theme`. Add the three helper variables below to `scripts/token-allowlist.json`.
4. `lib/theme/radius.ts`: radius scale by `borderRadius` (`xs`, `sm`, `md`, `lg`, `xl`, `pill` in px): `none` 0,0,0,0,0,0; `sm` 1,2,3,4,8,14; `md` (design default) 2,3,5,7,14,28; `lg` 4,6,10,14,20,28; `full` 4,999,12,16,24,999.
5. `lib/theme/adapter.ts`:
```ts
export function parseTheme(raw: unknown): ThemeTokens;                 // untrusted -> complete ThemeTokens: each field validated (colours via parseColour then toHex, enums by allow-list, fonts kept as raw string for resolveFontStack), missing or invalid -> value from MALVA_DEFAULT_THEME
export function buildThemeVars(raw: unknown): Record<string, string>; // only variables that differ from the default theme's variables
export function buildThemeCss(raw: unknown): string;                   // '' when there are no overrides, else ':root:root{--a:b;...}'
```
Mapping (variable names are the tokens of `app/tokens.css`; source of the table is theming-design):
| ThemeTokens field | Variables emitted |
| --- | --- |
| `colorPrimary` (+ optional `colorPrimaryHover`) | `--color-brand-50` to `--color-brand-950` from `brandRamp`; `--color-brand-deep` = stop 800; explicit chain: `--color-action`, `--color-text-link`, `--color-text-price`, `--color-focus`, `--color-border-brand`, `--color-surface-brand` = `var(--color-brand-700)`; `--color-action-hover` = `var(--color-brand-600)`; `--color-action-active` = `var(--color-brand-900)`; `--color-action-subtle`, `--color-surface-brand-subtle` = `var(--color-brand-50)`; `--color-surface-brand-deep` = `var(--color-brand-deep)` |
| `colorPrimaryForeground` (default `#ffffff`) | `--color-text-on-brand` |
| `colorSecondary` | `--color-surface-utility` |
| `colorAccent` | `--color-accent-50` to `--color-accent-900` from `accentRamp`; `--color-accent-gradient` = `linear-gradient(135deg, var(--color-accent-300), var(--color-accent-600) 55%, var(--color-accent-700))`; `--color-rating` = `var(--color-accent-600)` |
| `colorBackground` | `--color-surface-page` |
| `colorSurface` | `--color-surface`, `--color-surface-quiet` |
| `colorText`, `colorTextMuted` | `--color-text`, `--color-text-muted` |
| `colorBorder` | `--color-border`; `--color-border-strong` = the same colour with lightness reduced by 10 points |
| `fontHeading` | `--font-display` from `resolveFontStack` |
| `fontFamily` | `--font-body`, `--font-ui`, `--font-utility` from `resolveFontStack` (only when it differs from the default theme's family; see default 1) |
| `borderRadius` | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill` from the radius table |
| `cardShadow`, `shadowStyle` | `--shadow-card` from `cardShadow`; `shadowStyle: 'none'` forces `none`; `soft` uses `md`; the other shadow styles are ignored |
| `buttonStyle` | `--btn-secondary-bg`, `--btn-secondary-border`, `--btn-secondary-fg`: `solid` = `var(--color-action)`, `transparent`, `var(--color-text-on-brand)`; `outline` = `transparent`, `var(--color-action)`, `var(--color-action)`; `ghost` = `transparent`, `transparent`, `var(--color-action)`. Primary calls to action never read these. |
**Locked, never emitted:** status colours (`--color-success-*`, `--color-danger-*`, `--color-warning-*`, `--color-info-*`), fit-badge colours, `--space-*`, `--content-width`, `--container-width`, `--color-neutral-*`, focus ring width. **Ignored fields:** `colorDestructive*`, `surfaceBlur`, `surfaceOpacity`, `colorSurfaceGlass`, `backgroundStyle`, `animationStyle`, `headerStyle`, `spacingScale`, `shadowStyle` values other than `none` and `soft`, `letterSpacing`, `textTransform`, `borderWidth`, `borderStyle`, `fontWeight*`.
Helper variables: none are needed in components other than `--btn-secondary-*`.
Tests (`lib/theme/adapter.test.ts`, names are scenario names): `Default theme emits an empty block`, `No theme saved` (`buildThemeCss(null)` equals `buildThemeCss(MALVA_DEFAULT_THEME)` equals `''`), `Token change reaches every surface` (primary `#1f6f43` changes the brand ramp, `--color-action` chain, `--color-text-on-brand` untouched; and an assertion that every brand-derived token in `app/tokens.css` that references `--color-brand-*` is also re-declared by the adapter, found by parsing `tokens.css`), `Hostile value` (`colorPrimary: ';}</style><script>alert(1)</script>'`, `fontFamily: 'x;}</style>'`, `colorAccent: 'url(javascript:alert(1))'`, `borderRadius: '8px;}'`; result has no `<`, `>`, `;}`, `url(`, `javascript`, `</style` and equals the default's CSS), `Reseller picks a glass preset` (a document with `shadowStyle: 'neumorphic'`, `surfaceBlur: 'lg'`, `backgroundStyle: 'noise'`, `headerStyle: 'transparent'` gives the same CSS as without them), `Fit colours do not follow the theme` (`colorDestructive: '#ff8800'` leaves no `danger`, `fit` or `destructive` variable in the output), `Locked tokens are never emitted` (assert no key starts with `--color-success`, `--color-danger`, `--color-warning`, `--color-info`, `--space-`, `--color-neutral`, `--content-width`, `--container-width`), `Unknown family` (`fontFamily: 'Comic Sans MS'` gives `--font-body: system-ui, sans-serif` and no `Comic`), `Allowed family maps to variable` (`fontHeading: 'Archivo'` gives `--font-display: var(--font-archivo), system-ui, sans-serif`), `Radius scale none and full`, `Secondary button styles`, `Primary button tokens are untouched by buttonStyle` (no `--color-action*` variable depends on `buttonStyle`), `Partial documents are completed` (`{ colorPrimary: '#1f6f43' }` only), `Non-object input returns defaults` (`'string'`, `42`, arrays, `null`), `Selector is :root:root`.

### H-07 Theme read with TTL and fallback [SKILL: commercetools-platform] [SPEC: Theme read, sanitised, applied at first paint; Contentools unavailable; Theme changes apply predictably]
`lib/contentools/theme.ts` (`import 'server-only'`):
```ts
export const THEME_TTL_SECONDS = 60;
export const DEFAULT_NAMESPACE = 'default';
export function getStoreTheme(storeKey: string | null | undefined): Promise<unknown | null>; // React cache() wrapper over a module-level TTL cache (from lib/ttl-cache.ts)
```
Behaviour: invalid or missing key uses `default`. `GET ${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(key)}/configuration/theme`, header `x-project-key`, `cache: 'no-store'` (our own TTL cache owns freshness, so dev and production behave the same), `signal: AbortSignal.timeout(2000)`. 200 with a JSON object: cache and return it. 404 or `null` body: cache `null` and return `null` (the caller then shows the built-in default). Any other failure (network error, timeout, 5xx, non-JSON): return the last good value for that key (`getStale`), else `null`; do not cache the failure. The value is returned **unparsed**; `parseTheme` (H-06) is the single sanitising entry point and `app/layout.tsx` is the only caller.
Tests (`lib/contentools/theme.test.ts`, fake timers + mocked `fetch`): `Branches share the store theme` (same key twice, one request), `No theme saved` (404 gives null), `Null body gives null`, `Contentools unavailable` (first call succeeds, TTL passes, second call fails: last good returned; fresh key with failure: null), `Theme changes apply after the TTL` (value changes after 61 s, not after 30 s), `Request shape` (URL, header, no cookie, no authorization), `Timeout falls back`, `Invalid key uses default`, `Failure is not cached`.

### H-08 Root layout, published-page component, spike [SPEC: Applied at first paint; Published page; No page; createContext footgun]
1. `app/layout.tsx` (edit the file touched by A, B and C; keep their parts): read `x-store-key` through `headers()`; `const css = buildThemeCss(await getStoreTheme(key))`; inside `<head>` after any stylesheet imports render `<style id="store-theme" dangerouslySetInnerHTML={{ __html: css }} />` (always render the element, empty when the string is empty). `generateMetadata` is untouched.
2. `components/contentools/ContentoolsPage.tsx` (`'use client'`):
```tsx
interface Props { data: PuckData | null; storeKey: string; projectKey: string; locale: string; children?: ReactNode }
// null data -> <>{children}</>; else
// <div className="puck-page"><PuckApiProvider baseURL={CONTENTOOLS_PROXY_BASE} projectKey={projectKey} businessUnitKey={storeKey} locale={locale}><PuckDataRenderer data={data} config={<config from default 6>} locale={locale} /></PuckApiProvider></div>
```
`import type { PuckData }` from `@commercetools-demo/puck-types`; value imports of `puck-renderer`, `puck-api` and the config only here. `projectKey` is `process.env.CTP_PROJECT_KEY` read in the calling Server Component and passed as a prop (the project key is not a secret; the proxy still injects the header for browser calls).
3. Dev route `app/dev/contentools/[store]/page.tsx` (server): `const data = await getPublishedPage(store, HOME_SLUG)`; render `<ContentoolsPage data={data} storeKey={store} projectKey={...} locale="de-DE"><p data-testid="no-page">No published page</p></ContentoolsPage>`. Dev-only, covered by `check-no-dev-pages`. Also create `app/dev/theme/[store]/page.tsx` (server, dev-only): it reads `getStoreTheme(store)`, builds `buildThemeCss(...)`, and renders B's token specimen inside a wrapper with its own `<style id="store-theme-preview" dangerouslySetInnerHTML={{ __html: css }} />`, plus sample elements with these test ids and classes: `btn-primary` (`bg-action text-on-brand`), `price` (`text-text-price`), `chip` (`bg-accent-100`), `hero` (`bg-surface-brand-deep`), `fit-ok` (`bg-success-50 text-success-600`), `fit-no` (`bg-danger-50 text-danger-600`), `btn-secondary` (style from `--btn-secondary-*`). Component test `app/dev/theme/[store]/page.test.tsx`: `Preview applies the adapter output` and `Preview escapes nothing from the theme` (mock `getStoreTheme` with the hostile fixture; the rendered HTML has no `<script`).
4. **Spike (45 minutes max): does the renderer render on the server?** Write `components/contentools/ContentoolsPage.ssr.test.tsx` using `renderToString` from `react-dom/server` with a minimal `PuckData` of one block. Pick a block that exists: run `node -e "import('@commercetools-demo/puck-renderer').then(m=>console.log(Object.keys(m)))"` and inspect the config's `components` keys; choose a simple text block and copy its field names from `/Users/behnam/code/cms/puck/packages/puck-editor/src/config/` (read the block source). Then run `npm run build` and `npm run start` and request `/dev/contentools/qa-none`. If both work, scenario `Published page` is satisfied by SSR. If `jsdom` or `isomorphic-dompurify` breaks the server render or the Netlify-style bundle (`next build` warns about untraceable modules or the test throws), switch the import to `dynamic(() => import('./PuckRenderClient'), { ssr: false, loading: () => <div className="min-h-[70vh]" aria-hidden /> })` as the reference starter does (files `components/contentools/PuckRenderClient.tsx` and the dynamic wrapper), and mark the SSR test `Published page is in the initial HTML` as waived in the PR (allowed by the owner, Q-H02; no manual row is needed). Write the outcome in `plans/evidence/H/spike-ssr.md`.
Tests: `lib/theme/layout.test.tsx` (`Style element is first-paint`: render the root layout with mocked `headers()` and `getStoreTheme` returning the qa-green theme; expect `<style id="store-theme">` inside `<head>` containing `--color-brand-700:#1f6f43`; `Default store renders an empty style element`; `Spoofed store header outside dev is ignored` is tested in H-09), `ContentoolsPage.test.tsx` (`No page` renders children; `Published page renders blocks` with the block chosen in the spike; `createContext footgun` is the A-07 lint test against a fixture that imports a Puck package in a Server Component), plus `lib/contentools/server-boundary.test.ts` (`Server files import only types from Puck packages`: scan `lib/contentools/*.ts` and `app/**/page.tsx|layout.tsx` without `'use client'` for value imports of `@commercetools-demo/puck-*`).

### H-09 Read-only proxy and store-header hardening [SKILL: commercetools-storefront] [SPEC: Write through the storefront proxy; Contentools reads and the same-origin proxy]
`app/api/contentools/[...path]/route.ts`:
- Exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` (each handler calls the same function so write methods return 404 rather than 405).
- `isAllowed(method, segments: string[]): boolean` in `lib/contentools/proxy-policy.ts` (pure). Allowed: `GET` with segments `service/<store>/configuration/theme`, `service/<store>/published/puck-pages/<key>`, `service/<store>/published/puck-contents/<key>`, `service/datasource`, `service/datasource/<key>`, `service/products/search`; `POST` only `service/<store>/published/puck-pages/query` and `service/<store>/published/puck-contents/query`. `<store>` and `<key>` must match `/^[A-Za-z0-9_-]{2,256}$/`. Everything else, including `service/proxy-script` (an open URL fetcher in Contentools), `service/refresh-jwt`, `service/<store>/configuration` and every non-GET write, is not allowed and answers `new Response(null, { status: 404 })` with **no upstream request**. The list is the starting set; when workstream K shows a block needing another read route, add it to `proxy-policy.ts` with a test (record in the PR).
- Forward: `${CONTENTOOLS_ORIGIN}/${segments.join('/')}${search}`; request headers copied **except** `host`, `cookie`, `authorization` (the storefront session cookie must never reach Contentools); set `x-project-key` from `CTP_PROJECT_KEY`; body via `request.arrayBuffer()` only for non-GET/HEAD (the only POST is the page query); `redirect: 'manual'`; response headers copied except `content-encoding`, `content-length`, `transfer-encoding`, `connection`, `set-cookie`.
- Proxy store-header hardening: in `proxy.ts` (G's file) delete the inbound `x-store-key` header at the top, except for paths under `/dev` when `NODE_ENV !== 'production'`.
Tests (`lib/contentools/proxy-policy.test.ts`, `app/api/contentools/[...path]/route.test.ts` with mocked `fetch`): `Write through the storefront proxy` (PUT to `/api/contentools/service/qa-green/configuration/theme` returns 404 and `fetch` is not called), `POST write routes are 404`, `Delete is 404`, `Other service routes are 404` (`configuration`, `refresh-jwt`, `proxy-script`, `auth`), `Theme read is forwarded` (`x-project-key` injected, `host`, `cookie`, `authorization` removed), `Published page query is forwarded with the body`, `Hop-by-hop response headers are stripped`, `Set-Cookie from upstream is stripped`, `Redirect is not followed` (upstream 302 passes through), `Invalid store segment is 404`, `Spoofed store header is ignored` (proxy test: a request to `/de-DE/hartmann` with header `x-store-key: evil` forwards the resolved store key, and `/dev/...` keeps it only outside production).

### H-10 Developer publish script, fixtures, evidence tooling [SKILL: commercetools-platform] [SPEC: One theme per reseller store; No theme saved]
`scripts/contentools-theme.mjs` (Node 22, no dependencies, ESM). Usage:
```
node scripts/contentools-theme.mjs get    --store <key>
node scripts/contentools-theme.mjs put    --store <key> --file <path.json>     # create (POST) or update (PUT) the theme document
node scripts/contentools-theme.mjs delete --store <key>
```
Reads `../seed/.env.local` (`SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`) and `.env.local` (`CONTENTOOLS_ORIGIN`). Flow: client-credentials token (`POST {authUrl}/oauth/token`, Basic auth, `grant_type=client_credentials`), then `GET {apiUrl}/{projectKey}/custom-objects/contentools-configuration/contentools-jwt-token` and use its `value` as the Bearer token. If missing: exit 2 with `Contentools is not connected (OA-02)`. If the token is expired (decode `exp`): exit 2 with `Token expired: open the Contentools Merchant Center app once`. Then call the Contentools service: `get` is a plain `GET` with `x-project-key` (no token), `put` sends `POST /service/{store}/configuration/theme` with body `{ "value": <json> }` and, on a 409 or 400-already-exists answer, `PUT` to the same path; `delete` sends `DELETE`. Headers on writes: `Authorization: Bearer <jwt>`, `x-project-key`. Never print the token, the secret or any header. Only stores whose key is `default` or starts with `qa-` are accepted by `put` and `delete` (guard against touching a real reseller by mistake).
Fixtures `scripts/fixtures/themes/`: `qa-green.json` (copy of the default with `colorPrimary: "#1f6f43"`, `colorPrimaryHover: "#185a37"`, `colorAccent: "#2a6fdb"`, `borderRadius: "lg"`, `fontHeading: "Archivo, system-ui, sans-serif"`), `qa-navy.json` (`colorPrimary: "#1d3b78"`, `colorSecondary: "#101828"`, `borderRadius: "none"`, `fontFamily: "Comic Sans MS, cursive"`, `buttonStyle: "outline"`), `qa-hostile.json` (`colorPrimary: ";}</style><script>window.__pwned=1</script>"`, `fontFamily: "x;}</style><script>window.__pwned=1</script>"`, `borderRadius: "8px;}"`, `colorAccent: "url(javascript:alert(1))"`, plus `shadowStyle: "neumorphic"`, `surfaceBlur: "lg"`).
Tests (`scripts/contentools-theme.test.mjs`, with a local `http.createServer` as fake commercetools and fake Contentools; no network): `Refuses stores that are not default or qa-*`, `Missing JWT custom object exits 2 and prints no token`, `Expired token exits 2`, `Put falls back to PUT when POST says it exists`, `Output never contains the token or the client secret`, `Get needs no token`.
**Do not run `put` or `delete` until OA-02 is `DONE` and Claude has the go-ahead in section 6; the script writes commercetools custom objects through Contentools.**

### H-11 README, checks, dry run
Add a "Theming and Contentools" section to `storefront/README.md`: data flow diagram in text (`browser -> /api/contentools/service/* (read-only) -> Contentools`; `Server Component -> Contentools` with the project key), the TTL, the fallback order (fresh cache, stale cache, built-in default), how to run the publish script, the reserved QA namespaces, the proxy allow-list and how to extend it. Run `npm run check && npm run verify:build`.

## 5. Test-first scenarios (unit and component tests)

| Test name | File | Spec scenario |
| --- | --- | --- |
| `Branches share the store theme`, `No theme saved` | `lib/contentools/theme.test.ts`, `lib/theme/adapter.test.ts` | One theme per reseller store |
| `Token change reaches every surface` | `lib/theme/adapter.test.ts` | Token change reaches every surface |
| `Raw values are rejected at review` | `scripts/check-tokens.test.mjs` (B; plus the exempt-list test here) | Raw values are rejected at review |
| `Reseller picks a glass preset`, `Locked tokens are never emitted` | `lib/theme/adapter.test.ts` | Reseller picks a glass preset |
| `Fit colours do not follow the theme` | `lib/theme/adapter.test.ts` | Fit colours do not follow the theme |
| `Unknown family` | `lib/theme/fonts.test.ts`, `adapter.test.ts` | Unknown family |
| `Hostile value` | `lib/theme/adapter.test.ts`, `color.test.ts` | Hostile value (both specs) |
| `Contentools unavailable`, `Theme changes apply after the TTL` | `lib/contentools/theme.test.ts` | Contentools unavailable |
| `Published page returns puckData`, `Published page renders blocks` / `Published page is in the initial HTML` (or waived) | `lib/contentools/puck.test.ts`, `ContentoolsPage.ssr.test.tsx` | Published page |
| `No page` | `ContentoolsPage.test.tsx`, `puck.test.ts` | No page |
| `createContext footgun` | `eslint/rules.test.mjs` (A-07), `server-boundary.test.ts` | createContext footgun |
| `Write through the storefront proxy` and friends | `app/api/contentools/[...path]/route.test.ts` | Write through the storefront proxy |
| `Style element is first-paint` | `lib/theme/layout.test.tsx` | applied at first paint |

Header/footer scenario `Reseller edits content` is covered in workstream I (application components); H guarantees the adapter never emits structural variables.

## 6. Browser verification recipe (Chrome DevTools MCP, run by Claude)

Preconditions: OA-02 `DONE`; G4 gate. Claude (not the junior unless told) runs the publish script and cleans up after.
1. Publish QA themes: `node scripts/contentools-theme.mjs put --store default --file lib/theme/default-theme.json`, then `put --store qa-green --file scripts/fixtures/themes/qa-green.json`, `qa-navy`, `qa-hostile`. Start `npm run dev` (port 3000).
2. **Store A:** `navigate_page` `http://localhost:3000/dev/theme/qa-green` (page from H-08 step 3). Assert with `evaluate_script`: `getComputedStyle(document.querySelector('[data-testid="btn-primary"]')).backgroundColor === 'rgb(31, 111, 67)'`; the `price` colour is `rgb(31, 111, 67)`; `getComputedStyle(document.documentElement).getPropertyValue('--color-brand-700').trim() === '#1f6f43'`; the `hero` background is not the default `rgb(129, 0, 0)`; `fit-ok` and `fit-no` backgrounds equal the default tints (`rgb(234, 247, 233)` and `rgb(253, 238, 238)`); the display font stack contains the generated Archivo family. `take_screenshot` to `plans/evidence/H/theme-qa-green-1440.png`, then resize to 375 and save `theme-qa-green-375.png`.
3. **Store B:** `navigate_page` `/dev/theme/qa-navy`: primary `rgb(29, 59, 120)`, `--radius-md` equals `0px`, `getComputedStyle(body).fontFamily` starts with `system-ui` and `list_network_requests` shows no font request other than `/_next/static/media` (the Comic Sans fallback loads nothing); secondary button style outline (`--btn-secondary-bg` is `transparent`). Screenshot `theme-qa-navy-1440.png`.
4. **Fallback to default:** `/dev/theme/qa-unknown-store`: Contentools answers with the `default` namespace (or `null`); computed `--color-brand-700` is `#821810` and the style element is empty or absent of brand overrides. Screenshot `theme-default-1440.png`. Also `/dev/theme/default` gives the same.
5. **Hostile:** `/dev/theme/qa-hostile`: `window.__pwned === undefined`; `document.querySelectorAll('style#store-theme-preview, style#store-theme')` contents contain no `<script` and no `url(`; `list_console_messages` has no errors; screenshot `theme-hostile-1440.png`. Also `curl -s localhost:3000/dev/theme/qa-hostile | grep -c "__pwned"` prints `0`.
6. **First paint:** `curl -s -H 'x-store-key: qa-green' localhost:3000/dev/theme/qa-green | grep -o '<style id="store-theme">[^<]*</style>'` shows the override inside `<head>` (the dev path keeps the inbound header outside production; this proves the root-layout path). Save `plans/evidence/H/first-paint-head.txt`.
7. **No page:** `/dev/contentools/qa-green`: the `no-page` text is visible (fallback), no console errors. If a published page exists for some store at that time, assert its text is in `curl -s` output (initial HTML) and take `contentools-page.png`.
8. **Proxy:** in the page context `evaluate_script(() => fetch('/api/contentools/service/qa-green/configuration/theme').then(r => r.status))` is `200`; same URL with `{method:'PUT',body:'{}'}` is `404`; `fetch('/api/contentools/service/proxy-script?url=https://example.com')` is `404`; `fetch('/api/contentools/service/qa-green/configuration/header')` is `404`. Save `proxy-status.txt` (four numbers).
9. **TTL:** change `qa-green.json` primary to `#8e1f0b`, `put`; reload within 30 seconds (still green), `wait_for` 65 seconds (use a timed `evaluate_script` sleep, say so in the log), reload (now `#8e1f0b`). Record in `ttl.txt`.
10. **Contentools down:** restart dev with `CONTENTOOLS_ORIGIN=http://127.0.0.1:9`: `/dev/theme/qa-green` renders with the built-in default (maroon), no error page, no unhandled console errors; `/api/contentools/service/qa-green/configuration/theme` returns `502` or a failed fetch that the page tolerates (record the status). Screenshot `theme-contentools-down.png`.
11. **Cleanup:** `delete --store qa-green`, `qa-navy`, `qa-hostile` (keep `default`). Confirm with the MCP (section 7).

## 7. Project-data checks (MCP `b2b2c-automotive`, read-only)
- OA-02 proof: `mcp__b2b2c-automotive__read_custom_objects` with container `contentools-configuration`, `where: key="contentools-jwt-token"`. **Do not copy the value anywhere**; record only `exists: true` and `lastModifiedAt` in `plans/evidence/H/jwt-custom-object.md`.
- Before cleanup: container `configuration`, list keys; expect `default-theme`, `qa-green-theme`, `qa-navy-theme`, `qa-hostile-theme`. Check the stored `default-theme` value equals `lib/theme/default-theme.json` (field by field; record "equal" or the differing fields). Save `config-keys-before.md`.
- After cleanup: only `default-theme` remains among `qa-*` (expected: no `qa-*-theme`). Save `config-keys-after.md`.
- No write tools through the MCP; the publish script is the only writer and only for `default` and `qa-*`.

## 8. Manual items for `plans/TODO-MANUAL-TESTING.md` (OA/SO/M)
Add (never wait on them):
| ID | Needed by | Action | Status |
| --- | --- | --- | --- |
| OA-02 | H live checks | OA-02 is the owner step: install the `multitenant contentools` Merchant Center custom application and click **Connect** once, so that custom object `contentools-configuration` / `contentools-jwt-token` exists in the project. Then tell Claude. (Re-listed here so H's live checks can be scheduled; the master row stays OA-02.) | TODO |
| ~~old OA-H2~~ | removed | The owner already allowed the client-only Puck fallback (Q-H02 answered), so no acknowledgement row exists. | n/a |
| M-H-1 | H | 1) Open `plans/evidence/H/theme-qa-green-1440.png`, `theme-qa-navy-1440.png` and `theme-default-1440.png`. 2) Compare with `design/export/Reseller Storefront.dc.html` served over HTTP (see `design/README.md`). | Default theme looks like the Garage Maroon design; the other two clearly re-theme buttons, prices, hero band and radii while fit badges keep their colours | H live checks done | TODO |

## 9. Definition of done
- `npm run check` and `npm run verify:build` green; every test in section 5 exists and passes; no `it.skip`.
- `grep -rn "CONTENTOOLS_ORIGIN" --include='*.ts' --include='*.tsx' .` outside tests and `node_modules` shows only `lib/contentools/origin.ts` (plus `lib/env.ts` validation which reads the variable by name; the test `Only origin.ts reads the variable` states exactly the allowed files).
- The adapter output for the default theme is the empty string; for the hostile fixture it equals the default's output.
- No Puck value import in any Server Component (lint and `server-boundary.test.ts` green).
- Proxy returns 404 for every write and non-allow-listed route, with no upstream call (tests).
- Live checks in section 6 done or explicitly marked pending OA-02 (listed in `plans/TODO-MANUAL-TESTING.md`).
- Spike result for SSR written (client-only fallback is an accepted outcome, Q-H02 answered by the owner); Q-H01 to Q-H03 in `plans/notes/questions-ABCGH.md`.

## 10. Evidence to record
`plans/evidence/H/`: `spike-ssr.md`, `theme-qa-green-1440.png`, `theme-qa-green-375.png`, `theme-qa-navy-1440.png`, `theme-default-1440.png`, `theme-hostile-1440.png`, `theme-contentools-down.png`, `first-paint-head.txt`, `proxy-status.txt`, `ttl.txt`, `jwt-custom-object.md`, `config-keys-before.md`, `config-keys-after.md`, optional `contentools-page.png`, and the `npm run check` tail.
