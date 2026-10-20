<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream E: Design system (tokens, typography, atoms, icons, i18n catalogues)

## 1. Header

| Field | Value |
| --- | --- |
| ID | E |
| Name | Design system: one token layer, fonts, the shared atoms, the icon set, the three message catalogues |
| Depends on | A (`Done`: Tailwind v4, Vitest, ESLint hex rule, `@/i18n/routing`, minimal `messages/*.json`) |
| Wave | 2 (parallel with C and D) |
| Branch | `ws/e-design-system`; commit `ws-E: E-05 <summary>` |
| Primary spec | `openspec/specs/design-tokens-and-components/spec.md` |
| Generated templates that apply | none |
| Owner prerequisites | none to build. Optional rows drafted in `plans/notes/todo-E.md`: `SO-x` (German catalogue review, existing SO-03 covers it), `SO-x` (coffee glyphs), `M-E-01`, `M-E-02` |
| Skills to load first | `commercetools-storefront` (`references/b2c/ui-components.md`, `references/stack/nextjs/best-practices/image.md`, `server-components.md`). No commercetools API is called in E, so no task carries a `[SKILL]` tag except where noted |
| Design source | `design/export/b2b2c-retailer-design/project/app/colors_and_type.css`, `styles.css`, `components.jsx` (`ICONS`, atoms) |

## 2. Goal and scope

**Goal.** Every later screen is composed from one token layer and a small atom set, and a re-skin is a token-value change. The prototype's palette is kept (D-003); token **names** are final, **values** may change later.

**In scope**
- `app/tokens.css` (semantic tokens, palette, shape, motion, breakpoints), `app/typography.css`, `app/globals.css` wiring, Tailwind `@theme inline` mapping.
- Fonts with `next/font/google` (Archivo, Roboto, Roboto Mono) in the root layout.
- Atoms in `components/ui/`: `Button`, `ButtonLink`, `IconButton`, `Chip`, `Field` (+ `Input`, `Select`, `Textarea`), `OptionButton`, `ColorSwatch`, `Stepper`, `Card`, `Badge`, `AvailabilityDot`, `Rating`, `Drawer`, `Modal`, `Toast` (+ `ToastProvider`, `useToast`), `Steps`, `Icon`.
- The icon set (VELA `ICONS` minus unused B2B glyphs, plus `cup`, `bean`, `capsule`, `machine`).
- The base catalogue namespaces `common`, `ui`, `a11y`, `errors` in `en-US`, `de-DE`, `en-GB` (identical keys).
- A dev-only kitchen-sink page for self-verification.

**Out of scope**
- Header, footer, mega menu, store pill, locale chooser, mobile navigation, product card, filters, PDP, cart, checkout, account (F onwards use the atoms; they are not atoms).
- Hero artwork, page layouts, copy of pages, the real wordmark artwork (the wordmark is text, Q-022).
- Any new package (no `clsx`, no `class-variance-authority`, no icon library, no `jest-axe`): write the 10-line helper `cn`.
- Brand re-skin (owner decision D2); E only guarantees the swap is values-only.

**Overlap to note.** `design-tokens-and-components` lists Toast as a shared atom, `DEPENDENCY-PLAN` also lists "toast" under F. Default: E builds `Toast`, `ToastProvider` and `useToast`; F mounts `<ToastProvider>` in the layout and calls `useToast()`.

## 3. Design

### 3.1 Files

```
app/globals.css            @import 'tailwindcss'; @import './tokens.css'; @import './typography.css'; @import './motion.css';
app/tokens.css             :root { tokens } + @theme inline { color/radius/font/breakpoint mapping }
app/typography.css         @utility eyebrow, page-title, hero-title, wordmark, body defaults
app/motion.css             transitions helpers, fade-up, reduced motion
app/layout.tsx             (A's file) + fonts + body classes
app/[locale]/dev/design/page.tsx   kitchen sink (dev only)
components/ui/             Button.tsx ButtonLink.tsx IconButton.tsx Chip.tsx Field.tsx Badge.tsx Card.tsx
                           AvailabilityDot.tsx Rating.tsx OptionButton.tsx ColorSwatch.tsx Stepper.tsx
                           Drawer.tsx Modal.tsx Toast.tsx Steps.tsx Icon.tsx icons.ts use-dialog.ts
context/toast.tsx          ToastProvider, useToast
lib/cn.ts                  cn(...)
messages/*.json            namespaces common, ui, a11y, errors (A's keys kept)
test/render.tsx            renderWithIntl
```

### 3.2 Tokens (`app/tokens.css`)

Semantic tokens, names fixed by the spec. Values are VELA's (re-checked against `styles.css` and `colors_and_type.css`) except the two marked **AA**:

```css
:root {
  --ink: #191741;  --ink-2: #4F4F99;  --ink-3: #6E6B67;   /* AA: VELA #7C7975 is 4.12:1 on canvas and 3.81:1 on canvas-2, below 4.5 (Q-E-1) */
  --canvas: #FBF9F5;  --canvas-2: #F4F0E8;  --surface: #FFFFFF;
  --line: #E7E2D9;  --line-2: #DEDAD4;
  --accent: #6359FF;  --accent-press: #4242B2;
  --teal: #0BBFBF;  --ct-amber-500: #FFB000;  --ct-danger: #E5484D;
  --maxw: 1320px;
  /* additions for accessibility (new names, nothing renamed) */
  --teal-strong: #0A948F;   /* graphics on white: 3.72:1 (done step circle, check marks on light) */
  --teal-text: #08746F;     /* teal as TEXT on canvas, canvas-2, surface (5.34, 4.94, 5.62) */
  --danger-text: #C62F35;   /* error text and destructive button fill (5.17, 4.79, 5.44; white on it 5.44) */
  --stone: #C6C2BC;         /* out-of-stock dot (VELA --ct-stone-400) */
  --footer-heading: #8F8FFF; --footer-link: #C2C2FF; --footer-meta: #8F8FFF;  /* on ink: 6.08, 10.04, 6.08 (VELA footer meta #7979D1 is 4.41, below AA) */
  --ring: color-mix(in srgb, var(--accent) 14%, transparent);   /* field focus ring 0 0 0 3px */
  --overlay: color-mix(in srgb, var(--ink) 42%, transparent);   /* overlay at 42% ink */
  --swatch-black: ..;  --swatch-white: ..;  --swatch-red: ..;  --swatch-silver: ..;  --swatch-cream: ..;  --swatch-fallback: var(--canvas-2);
  /* shape */
  --radius-pill: 999px;  --radius-field: 10px;  --radius-card: 16px;  --radius-panel: 24px;  --radius-hero: 32px;
  /* motion */
  --dur-press: 120ms;  --dur-state: 200ms;  --dur-drawer: 320ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --shadow-lg: 0 20px 48px rgba(0,0,0,0.45);   /* VELA --ct-shadow-lg, used by modal and toast */
  --shadow-card-hover: 0 18px 40px color-mix(in srgb, var(--ink) 10%, transparent);
}
```
Swatch values (colour enum keys come from the seed `COLOURS`: `black`, `white`, `red`, `silver`, `cream`): black `#1C1B1F`, white `#F7F7F5`, red `#B3262B`, silver `#B8BCC2`, cream `#EADFC8`. A colour key without a `--swatch-<key>` token falls back to `--swatch-fallback` (tested).

Also keep the palette scales needed by later screens in the same file, named as in `colors_and_type.css` (`--ct-violet-*`, `--ct-navy-*`, `--ct-teal-*`, `--ct-amber-*`, `--ct-stone-*`); drop the dark-mode `--ct-bg-*`/`--ct-fg-*`, glows and aurora (not used by the light storefront; O may append).

Tailwind mapping (`@theme inline` so utilities emit `var(--token)` and a re-skin changes only `:root`):
```css
@theme inline {
  --color-ink: var(--ink);  --color-ink-2: var(--ink-2);  --color-ink-3: var(--ink-3);
  --color-canvas: var(--canvas);  --color-canvas-2: var(--canvas-2);  --color-surface: var(--surface);
  --color-line: var(--line);  --color-line-2: var(--line-2);
  --color-accent: var(--accent);  --color-accent-press: var(--accent-press);
  --color-teal: var(--teal);  --color-teal-strong: var(--teal-strong);  --color-teal-text: var(--teal-text);
  --color-amber: var(--ct-amber-500);  --color-danger: var(--ct-danger);  --color-danger-text: var(--danger-text);
  --color-stone: var(--stone);
  --radius-pill: var(--radius-pill);  --radius-field: var(--radius-field);  --radius-card: var(--radius-card);
  --radius-panel: var(--radius-panel);  --radius-hero: var(--radius-hero);
  --font-display: var(--font-archivo), -apple-system, 'Helvetica Neue', Arial, sans-serif;
  --font-body: var(--font-roboto), -apple-system, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: var(--font-roboto-mono), ui-monospace, 'SF Mono', Menlo, monospace;
  --breakpoint-*: initial;               /* remove Tailwind defaults */
  --breakpoint-xs: 520px;  --breakpoint-narrow: 700px;  --breakpoint-mobile: 820px;  --breakpoint-stack: 900px;  --breakpoint-grid3: 1080px;
}
```
Usage in components: `bg-canvas text-ink border-line rounded-card font-display`; responsive: mobile-first `mobile:` = min-width 820px, and `max-mobile:` = below 820px (Tailwind v4 `max-*` variants). The prototype's `max-width: 820px` is inclusive; `max-mobile:` is `width < 820px`. 820 itself counts as the larger layout; record in `plans/PROJECT-FINDINGS.md` if a design check notices it.

Spacing: Tailwind's default step is 4px. Rule: use multiples of 8px (`p-2`=8, `p-4`=16, `p-6`=24, `p-8`=32) for layout, 4px steps only inside atoms (Q-E-3). Do not change `--spacing`.

Global focus (the spec says "focus visible on every control"): in `typography.css` `:where(a, button, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Fields additionally show `box-shadow: 0 0 0 3px var(--ring)` and border `--accent` on focus.

### 3.3 Typography (`app/typography.css`, fonts in `app/layout.tsx`)

Fonts (docs: `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`):
```tsx
import { Archivo, Roboto, Roboto_Mono } from 'next/font/google';
const archivo = Archivo({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-archivo', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], weight: ['300','400','500','700'], variable: '--font-roboto', display: 'swap' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], weight: ['400','500'], variable: '--font-roboto-mono', display: 'swap' });
// <html lang={locale} className={`${archivo.variable} ${roboto.variable} ${robotoMono.variable}`}><body className="bg-canvas text-ink font-body">
```
`next/font/google` downloads the font files at **build time** and self-hosts them; the browser never calls Google. If the build machine has no network, switch to `next/font/local` with the `woff2` files committed under `app/fonts/` (all three are OFL licensed) (Q-E-2). Weight lists above are explicit because Next requires `weight` for non-variable fonts.

Typography rules (values from the spec):
| Utility | Definition |
| --- | --- |
| body (on `body`) | Roboto, `font-size: 15px; line-height: 1.55` |
| `eyebrow` | 11px, uppercase, `letter-spacing: 0.18em`, weight 600, colour `--ink-3` |
| `page-title` | Archivo 800, `font-size: clamp(34px, 3.2vw, 40px)`, `letter-spacing: -0.025em`, line-height 1.1 |
| `hero-title` | Archivo 800 (weight 700 allowed by the design; use 800), `font-size: clamp(44px, 5.6vw, 82px)`, `letter-spacing: -0.025em`, line-height 1.02, `text-wrap: balance` |
| `section-title` | Archivo 700, 34px (27px under 820px), `-0.02em` |
| `wordmark` | Archivo 800, 25px, `letter-spacing: 0.16em` (21px under 520px) |
| mono | `font-mono` for order numbers, codes and cart counts |
Headings use `font-display` with weights 600 to 800 and negative tracking on large sizes.

### 3.4 Shape, spacing, motion, layout utilities

`app/globals.css` / `motion.css` provide:
- `@utility wrap { max-width: var(--maxw); margin-inline: auto; padding-inline: 32px; width: 100%; }` and `@media (max-width: 819.98px) { wrap padding-inline: 20px }` (written as `@utility wrap { ... @variant max-mobile { padding-inline: 20px } }` if the compiler accepts it; otherwise the media query).
- `@utility grid-products`: 4 columns, `gap: 28px 24px`; 3 columns below 1080px; 2 columns below 820px (`gap: 20px 16px`).
- Transitions: `transition-press` (120ms), `transition-state` (200ms) and `transition-drawer` (320ms, `--ease-out`) utilities.
- Entrance: `@utility fade-up` inside `@media (prefers-reduced-motion: no-preference)`: `animation: fadeUp var(--dur-drawer) var(--ease-out) both` and `@keyframes fadeUp { from { transform: translateY(10px) } to { transform: none } }`. **No opacity in the keyframes** (content never hidden at rest, spec scenario). Global `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important } }`.

### 3.5 Atoms: exports, props, behaviour

All in `components/ui/`, one default export per file plus named types, props extend the matching `HTML*Attributes` and spread `...props`, no domain imports (no `lib/ct`, no mappers, no hooks of other workstreams). Strings visible to users come in as props or from the `ui`/`a11y` catalogue via `useTranslations` (client components) so the atoms work in all three languages.

```ts
// lib/cn.ts
export function cn(...parts: Array<string | false | null | undefined>): string;   // joins truthy parts with a space

// Button.tsx
type Variant = 'ink' | 'accent' | 'ghost'; type Size = 'md' | 'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; block?: boolean; loading?: boolean }
export default function Button(props: ButtonProps): JSX.Element;          // default type="button", variant ink, pill radius, Archivo 600 14px (lg 15px), press scale 0.985, disabled opacity 0.4 and pointer-events none
export function buttonClasses(o: { variant?: Variant; size?: Size; block?: boolean }): string;   // for ButtonLink and any element

// ButtonLink.tsx  ('use client'-free; uses Link from '@/i18n/routing')
interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> { variant?: Variant; size?: Size; block?: boolean }
export default function ButtonLink(props: ButtonLinkProps): JSX.Element;
// external URLs: an <a> with rel="noopener noreferrer" is written by the caller, not ButtonLink

// IconButton.tsx   (40px round, icon only)
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; icon: IconName; badgeCount?: number }
export default function IconButton(p: IconButtonProps): JSX.Element;      // aria-label = label (required by type); icon aria-hidden; badgeCount renders the mono cart count pill (accent fill)

// Chip.tsx
interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> { active?: boolean }   // aria-pressed={active}; hover ink border; active ink fill white text

// Field.tsx
export function Field(p: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }): JSX.Element;  // label 12.5px weight 600 ink-2 above; error text danger-text with id `${htmlFor}-error`
export const Input: ForwardRefExoticComponent<InputHTMLAttributes<HTMLInputElement> & { shape?: 'field' | 'pill'; invalid?: boolean }>;   // field radius 10px, pill radius for search; focus: border accent + ring; aria-invalid, aria-describedby set by Field via cloneElement-free convention: the caller passes id and aria-describedby
export const Select: ForwardRefExoticComponent<SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>;
export const Textarea: ForwardRefExoticComponent<TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>;

// OptionButton.tsx  (variant choice: pack size, grind, colour name)
type OptionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & { selected?: boolean } &
  ({ disabled: true; disabledReason: string } | { disabled?: false; disabledReason?: never });
// selected: ink fill white text. disabled: line-through text, canvas-2 fill, ink-3 text, aria-disabled="true", title={disabledReason}, onClick ignored; stays focusable so the reason is reachable. aria-pressed={selected}.

// ColorSwatch.tsx
interface ColorSwatchProps { colour: string; label: string; size?: 'sm' | 'lg'; selected?: boolean; onSelect?: () => void }
// sm 14px (cards), lg 42px (detail). Background var(--swatch-<colour>) else var(--swatch-fallback). With onSelect it is a <button aria-pressed aria-label={label}>, otherwise <span role="img" aria-label={label}>. selected ring: box-shadow 0 0 0 2px var(--canvas), 0 0 0 4px var(--ink).

// Stepper.tsx   ('use client')
interface StepperProps { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string; disabled?: boolean }
// pill, two 38px buttons (aria-label from ui.stepper.decrease/increase), value in a span aria-live="polite"; minus disabled at min, plus disabled at max; role="group" aria-label={label}

// Card.tsx            interface CardProps extends HTMLAttributes<HTMLDivElement> { as?: 'div' | 'section' | 'article' }   // surface, 1px line, radius 16px, padding 24px
// Badge.tsx           interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { variant?: 'ink' | 'accent' }          // pill, 10px uppercase 0.1em tracking, ink (Bestseller) accent (New)
// AvailabilityDot.tsx interface Props { state: 'in' | 'low' | 'out'; label?: string }                                      // 7px; teal | amber | stone; with label: role="img" aria-label, without: aria-hidden
// Rating.tsx          interface Props { value: number; count?: number; small?: boolean }                                    // star icon filled, value = roundRating(value).toFixed(1), count with Intl.NumberFormat(locale); aria-label from ui.rating.label ICU plural; renders null when value <= 0
```
Drawer and Modal (`'use client'`), shared hook `use-dialog.ts`:
```ts
export function useDialog(o: { open: boolean; onClose: () => void; ref: RefObject<HTMLElement | null> }): void;
// when open: store document.activeElement, move focus to the first focusable inside ref (or the ref itself, tabIndex -1), trap Tab and Shift+Tab inside, Escape calls onClose, lock body scroll (overflow hidden), on close restore focus to the stored element and unlock.
interface DrawerProps { open: boolean; onClose: () => void; title: string; footer?: ReactNode; side?: 'right' | 'left'; children: ReactNode }
// width min(440px, 100vw); panel bg canvas; overlay var(--overlay) fades 200ms; panel slides 320ms var(--ease-out). Head: Archivo 700 19px title + IconButton close (label ui.close). Body scrolls, footer sticky on surface with top line. role="dialog" aria-modal="true" aria-labelledby the title id. When closed: inert, aria-hidden, visibility hidden after the transition (not focusable). Click on the overlay closes.
interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode }
// centred width min(560px, 94vw), max-height 88vh scrolls, radius 24px, shadow-lg, same dialog semantics.
```
Toast (`context/toast.tsx`, `components/ui/Toast.tsx`):
```ts
export function ToastProvider(p: { children: ReactNode }): JSX.Element;   // renders the toast region
export function useToast(): { show: (message: string) => void };
// bottom centre pill, ink fill white text 13.5px, teal check icon (Icon check, colour --teal on ink), auto-dismiss after 2200 ms, a new message replaces the old one and restarts the timer, region role="status" aria-live="polite".
```
Steps (`Steps.tsx`):
```ts
interface StepsProps { steps: Array<{ key: string; label: string }>; current: string }   // <ol>; done steps (before current) teal-strong circle with check icon, active ink circle with number, pending line circle; connector 28px line; aria-current="step" on the active li
```
Icon (`Icon.tsx`, `icons.ts`):
```ts
export type IconName = keyof typeof ICONS;
export default function Icon(p: { name: IconName; size?: number; className?: string; fill?: 'none' | 'currentColor'; title?: string }): JSX.Element;
// <svg width height viewBox="0 0 24 24" fill stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"> ; with `title` it becomes role="img" with <title> and no aria-hidden. Default size 20.
```
`icons.ts` copies the VELA `ICONS` path strings for: `search user bag heart pin star chevR chevD chevL x check truck store menu pkg clock gift card settings logout arrowR minus plus shield repeat leaf globe filter zap trash message lock edit`. Not copied (no use here): `ruler` (a size guide; replaced by the compatibility guide), `building`, `upload`, `list`, `send`, `corner`, `x2` (duplicate of `x`). Store each icon as an array of path strings (split once, do not `split(' M')` at render time). New coffee glyphs, same style (starter paths, check at 24px and 96px, Q-E-5):
```ts
cup:     ['M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z', 'M17 10h1.5a2.5 2.5 0 0 1 0 5H17', 'M8 3v2', 'M12 3v2'],
bean:    ['M12 3c4.5 0 8 4 8 9s-3.5 9-8 9-8-4-8-9 3.5-9 8-9Z', 'M12 3c-3 3.5 3 5.5 0 9s3 5.5 0 9'],
capsule: ['M4 5.5h16v2H4z', 'M5.5 7.5l1.6 11.3a1.5 1.5 0 0 0 1.5 1.2h6.8a1.5 1.5 0 0 0 1.5-1.2L18.5 7.5'],
machine: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M5 8h14', 'M12 11v3', 'M8.5 17.5h7'],
```
The prototype also uses emoji nowhere; none may be added.

### 3.6 i18n catalogue (keys identical in the three files; A's keys stay)

Namespaces and keys E adds (values in all three languages; German is real German, en-GB uses British spelling where it differs):
- `common`: `brand`, `skipToContent`, `close`, `open`, `back`, `next`, `save`, `cancel`, `remove`, `edit`, `loading`, `retry`, `yes`, `no`.
- `ui`: `stepper.decrease`, `stepper.increase`, `rating.label` (`"{value} out of 5, {count, plural, one {# review} other {# reviews}}"`, de `"{value} von 5, {count, plural, one {# Bewertung} other {# Bewertungen}}"`), `rating.reviews` (`"{count, plural, one {# review} other {# reviews}}"`), `option.unavailable` (`"Not available"`), `toast.dismiss`, `drawer.close`, `modal.close`, `steps.done` (`"completed"`), `steps.current` (`"current step"`), `field.required`, `field.optional`.
- `a11y`: `menu`, `cart`, `search`, `account`, `store`, `language`, `filters`, `previousImage`, `nextImage`.
- `errors`: A's keys plus `generic`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `upstream_unavailable`, `validation_failed`, `internal_error` (one key per `ErrorCode` of D so `errors.<code>` always exists).
Other workstreams add their own namespaces to **all three** files in the same commit; `messages.test.ts` (A) fails otherwise. Brand is "Malva Coffee" in all three; "Nespresso" appears only inside compatibility sentences, never as a brand (guide rule 11): E adds a test that no catalogue contains `Nespresso` outside the word pairs `Nespresso Original` and `Nespresso Vertuo`.

## 4. Tasks

Run `cd storefront && npm run check` before ticking. `[SKILL]` tags: none (no commercetools API in E).

- [ ] **E-01 Token layer and its tests**
  - Files: `app/tokens.css`, `app/globals.css`, `test/css.ts` (helper that reads and parses a CSS file into a map of custom properties and at-rules), `test/contrast.ts` (`contrast(fgHex, bgHex): number`), `app/tokens.test.ts`.
  - Implement 3.2. `globals.css` becomes the four `@import` lines plus `body { margin: 0; }`.
  - Tests (spec: Single token layer, Re-skin by token, Accessibility): `Tokens in sync: every token named in the spec table exists in tokens.css` (read `openspec/specs/design-tokens-and-components/spec.md`, parse the first table's first column, compare **names only**), `Re-skin by token: replacing every colour value leaves no component with a raw value` (rewrite all hex values in a copy of `tokens.css` to other hexes, assert the component scan below still finds none), `No component contains a raw colour, font or radius value` (scan `components/**`, `app/**/*.tsx`: no hex, no `rgb(`/`hsl(`, no `font-family`, no `rounded-[`, no `font-[`), `Text tokens meet WCAG AA on canvas, canvas-2 and surface` (ink, ink-2, ink-3, teal-text, danger-text, and white on accent, on danger-text, on accent-press; plus footer tokens on ink; plus teal-strong 3:1 on surface), `Tailwind mapping covers every colour token`.

- [ ] **E-02 Fonts and typography**
  - Files: `app/layout.tsx`, `app/typography.css`, `app/typography.test.ts`.
  - Implement 3.3. Replace A's root layout font handling; keep `NextIntlClientProvider` and `lang`.
  - Tests (spec: Typography, Page title): `Page title is Archivo 800 at 34 to 40px with -0.025em tracking` (parse `page-title` rule: weight 800, `clamp(34px, ..., 40px)`, `-0.025em`, `font-display`), `Hero title scales with clamp(44px, 5.6vw, 82px)`, `Eyebrow is 11px uppercase 0.18em weight 600`, `Wordmark is Archivo 800 with 0.16em spacing`, `Body is 15px with line-height 1.55`, `Layout loads Archivo, Roboto and Roboto Mono with their variables` (read `layout.tsx` source).

- [ ] **E-03 Shape, spacing, motion, breakpoints**
  - Files: `app/motion.css`, `app/globals.css` (utilities), `app/layout-utils.test.ts`.
  - Implement 3.4 and the breakpoints of 3.2.
  - Tests (spec: Shape, spacing and motion; Breakpoints; Phone): `Radii are pill, 10, 16, 24 and 32`, `Durations are 120, 200 and 320 ms`, `Content never hidden at rest: the entrance keyframes are transform-only and wrapped in prefers-reduced-motion no-preference`, `Reduced motion removes animation durations`, `Phone: breakpoints are defined at 520, 700, 820, 900 and 1080 px`, `Phone: grid-products is 4, then 3 below 1080 and 2 below 820 columns`, `Phone: wrap padding is 32px and 20px under 820px`.

- [ ] **E-04 Icons and IconButton**
  - Files: `lib/cn.ts`, `components/ui/icons.ts`, `components/ui/Icon.tsx`, `components/ui/IconButton.tsx`, `test/render.tsx` (`renderWithIntl(ui, { locale = 'en-US' })` wrapping `NextIntlClientProvider` with the real catalogue), tests.
  - Implement 3.5 Icon, IconButton, `cn`. Add the four coffee glyphs.
  - Tests (spec: Iconography, Accessibility): `New glyph: every icon renders a 24px viewBox, 1.75 stroke, round caps and joins`, `New glyph: cup, bean, capsule and machine exist`, `Icon paths use only drawing commands M L H V C S Q T A Z` (regex on path data), `No emoji in the icon set or in components` (scan for emoji code points), `Icon button: an icon-only control has an accessible name` (`getByRole('button', { name: 'Cart' })`), `Icon button: decorative icons are aria-hidden`, `Icon with a title is exposed as an image`, `cn drops falsy parts`.

- [ ] **E-05 Button, ButtonLink, Chip, Badge, Card, AvailabilityDot, Rating**
  - Files: one component and one test per file in `components/ui/`.
  - Implement per 3.5.
  - Tests: `Button defaults to ink and type button`, `Button accent and ghost classes differ`, `Button disabled has opacity 40 and blocks clicks`, `Button loading disables and exposes aria-busy`, `ButtonLink renders an anchor with the locale prefix` (mock `@/i18n/routing` Link if `next/link` needs router context), `Chip active sets aria-pressed`, `Chip active uses ink fill`, `Badge variants ink and accent`, `AvailabilityDot has three states and a label when given`, `Rating shows 4.6 and 12 reviews for 4.58333 and 12` (spec reviews-and-ratings: Card rating), `Rating renders nothing for no rating` (value 0), `Rating label is announced with a plural` (en and de), `Card renders as the chosen element`.

- [ ] **E-06 Field, OptionButton, ColorSwatch, Stepper**
  - Files: components and tests.
  - Tests (spec: Shared atoms, Disabled option explains itself): `Disabled option explains itself: struck through, not selectable, carries a title` (assert `line-through` class, `aria-disabled`, `title`, `onClick` not called), `Disabled option is still focusable`, `TypeScript refuses a disabled option without a reason` (`// @ts-expect-error` line in the test, checked by `npm run typecheck`), `Selected option uses the ink fill and aria-pressed`, `Field shows its label above and the error text with aria-describedby`, `Input focus uses the ring token` (class assertion), `Colour swatch uses the swatch token and falls back for unknown colours`, `Colour swatch selected has the double ring`, `Colour swatch as a button has an accessible name`, `Stepper increments, decrements and stops at min and max`, `Stepper buttons have localized labels in de-DE`, `Stepper announces the value politely`.

- [ ] **E-07 Drawer and Modal**
  - Files: `components/ui/use-dialog.ts`, `Drawer.tsx`, `Modal.tsx`, tests.
  - Tests (spec: Accessibility, Shared atoms): `Drawer opens with focus inside and a dialog role`, `Escape closes the drawer`, `Tab is trapped inside the drawer`, `Focus returns to the opener on close`, `Overlay click closes`, `Closed drawer is inert and not focusable`, `Body scroll is locked while open and restored`, `Drawer is 440px wide and Modal is 560px with a 24px radius` (class assertions), `Modal title labels the dialog`, `Drawer close button has a localized accessible name`.

- [ ] **E-08 Toast and Steps**
  - Files: `context/toast.tsx`, `components/ui/Toast.tsx`, `Steps.tsx`, tests (use `vi.useFakeTimers()`).
  - Tests: `Toast shows the message with a polite live region`, `Toast disappears after 2.2 seconds`, `A second message replaces the first and restarts the timer`, `useToast outside the provider throws a clear error`, `Steps marks done, active and pending`, `Steps sets aria-current on the active step`, `Steps done circle shows a check icon`.

- [ ] **E-09 Message catalogues (identical keys, three languages)**
  - Files: `messages/en-US.json`, `de-DE.json`, `en-GB.json`, `messages/catalogue.test.ts`.
  - Implement 3.6. Use real German; ask for the native review (SO-03).
  - Tests (spec: bootstrap Adding a market, extended): `Catalogues have identical keys` (reuses A's helper), `German values differ from English except an allow-list` (allow-list: `common.brand`, any value without a letter, `ui.field.optional` if equal), `ICU messages parse in all three languages` (use `IntlMessageFormat`? not installed: instead render `ui.rating.label` through `NextIntlClientProvider` for counts 0, 1, 12), `Nespresso appears only in compatibility wording`, `Every ErrorCode of lib/errors has an errors.<code> key`, `No catalogue value contains a hex colour or HTML tag`.

- [ ] **E-10 Kitchen-sink page and predeploy gate**
  - Files: `app/[locale]/dev/design/page.tsx`, `app/[locale]/dev/design/KitchenSink.tsx` (client), `scripts/predeploy-check.mjs` and its test (extend: fail while `app/[locale]/dev` exists).
  - The page shows: every token as a labelled swatch (name beside it, using `style={{ background: 'var(--ink)' }}` strings, never hex), the type scale, every atom in every state (default, hover note, focus, disabled, selected, loading), the icon grid (name under each icon at 24px and 96px), a Drawer and Modal opener, a Toast button, Steps with three states, and the grid utility with 8 placeholder cards. The page 404s when `NODE_ENV === 'production'`.
  - Tests: `Kitchen sink is 404 in production`, `Deploy gate fails while app/[locale]/dev exists`.

- [ ] **E-11 Browser verification and evidence** Run section 6 and section 7; save evidence.

- [ ] **E-12 Agent rules for design use**
  - Files: `storefront/AGENTS.md` (append "Design system": the token names, "no hex, no raw font, no inline radius", the atom list with props, `buttonClasses` for links, how to add an icon, how to add a message key to all three files), `agent-rules.test.ts` extended: `AGENTS.md names the tokens and the atom list`.

## 5. Scenarios checklist (`design-tokens-and-components`)

- [ ] Re-skin by token: `Re-skin by token: replacing every colour value leaves no component with a raw value` (E-01)
- [ ] Page title: `Page title is Archivo 800 at 34 to 40px with -0.025em tracking` and `Hero title scales with clamp(44px, 5.6vw, 82px)` (E-02) plus browser step 4 computed styles
- [ ] Content never hidden at rest: `Content never hidden at rest: the entrance keyframes are transform-only and wrapped in prefers-reduced-motion no-preference` (E-03) plus browser step 6
- [ ] Disabled option explains itself: `Disabled option explains itself: struck through, not selectable, carries a title` (E-06)
- [ ] New glyph: `New glyph: every icon renders a 24px viewBox, 1.75 stroke, round caps and joins` and `New glyph: cup, bean, capsule and machine exist` (E-04) plus screenshot `E-icons-1440.png`
- [ ] Phone: `Phone: grid-products is 4, then 3 below 1080 and 2 below 820 columns` (E-03) plus browser step 7 at 390 px (two columns). The slide-in nav and the full-height filter sheet are built in F and G; their Phone assertions are listed there
- [ ] Icon button: `Icon button: an icon-only control has an accessible name` (E-04)
- [ ] Requirement Single token layer: `Tokens in sync...`, `No component contains a raw colour, font or radius value` (E-01)
- [ ] Requirement Shape, spacing and motion: radii and duration tests (E-03)
- [ ] Requirement Shared atoms: one test group per atom (E-05 to E-08)
- [ ] Requirement Accessibility: `Text tokens meet WCAG AA...` (E-01), Lighthouse accessibility run (browser step 9)

## 6. Browser recipe (Chrome DevTools MCP, you run it)

Load the tools with ToolSearch first. Evidence in `plans/evidence/E/`.

1. `cd storefront && npm run dev` (background). `resize_page` 1440x900. `navigate_page` `http://localhost:3000/en-US/dev/design`.
2. `take_snapshot` and confirm each heading exists (Tokens, Type, Buttons, Chips, Fields, Options, Swatches, Stepper, Cards and badges, Availability and rating, Drawer, Modal, Toast, Steps, Icons, Grid). `take_screenshot` full page: `E-kitchen-1440.png`; icons section only: `E-icons-1440.png`.
3. Fonts: `evaluate_script`: `document.fonts.ready.then(()=>[document.fonts.check('800 40px Archivo'), document.fonts.check('400 15px Roboto'), document.fonts.check('400 13px "Roboto Mono"')])` returns three `true`. `list_network_requests`: font files come from `/_next/static/media/*.woff2`, **no** request to `fonts.googleapis.com` or `fonts.gstatic.com`.
4. Computed styles (`evaluate_script` with `getComputedStyle`) on the sample page title: `fontFamily` starts with the Archivo variable family, `fontWeight` `800`, `fontSize` `40px` at 1440 and `34px` at 375, `letterSpacing` equal to `-0.025em` in px (`-1px` at 40px). On the hero sample: font size between 44px and 82px (`5.6vw` at 1440 is `80.64px`). On `.eyebrow` sample: `11px`, `uppercase`, `0.18em` (`1.98px`). Save results as `E-computed-styles.json`.
5. Interaction states (`take_snapshot` for uids, then `click`/`hover`/`press_key`): hover a ghost button (ink border), `press_key Tab` to focus the next control and screenshot `E-focus-1440.png` (visible 2px accent outline), open the Drawer (440px wide: `evaluate_script` `document.querySelector('[role=dialog]').getBoundingClientRect().width === 440`), press `Escape` (closes, focus returns to the opener), open the Modal (width 560), click the Toast button (toast visible 2.2 s then gone: `wait_for` text, then confirm it disappears), toggle the disabled option (`title` visible: `get`/`evaluate_script` `el.title`).
6. Content never hidden: `evaluate_script`: elements inside `main` whose computed `opacity === '0'` and that are not inside a closed (`inert`) drawer or modal. Expect an empty list. Reload and run it within 50 ms of load as well (`navigate_page` with `initScript` that records the same check on `DOMContentLoaded`). If the `emulate` tool supports reduced motion, enable it and repeat; otherwise confirm `document.getAnimations().length` is 0 after 1 s.
7. `resize_page` 390x844 (and 375x812): screenshot `E-kitchen-375.png`; `evaluate_script` that the product grid sample has two columns (`getComputedStyle(grid).gridTemplateColumns.split(' ').length === 2`) and `wrap` padding is `20px`; 700 px width: still two columns; 1000 px: three; 1440: four.
8. `list_console_messages`: no errors or warnings (fix hydration warnings, `aria` warnings). `list_network_requests`: no failed request.
9. `lighthouse_audit` (accessibility) on the kitchen-sink page at desktop and mobile; save the summary scores and the failing audit ids to `E-lighthouse.json`. Fix every contrast or label failure that comes from an atom; failures from the dev page chrome only are noted.
10. `plans/evidence/E/README.md`: one line per file.

## 7. Self-verification with data

E has no commercetools data. Verify by:
- the CSS/contrast unit tests (they read the real token file, so they re-check after any token value change);
- the computed-style checks in step 4 (a second, independent read of the same values);
- `grep -rn "Nespresso" storefront/messages` for the brand rule;
- if the seed images exist (`seed/src/data/images.json`), render one image in the kitchen sink through `transformListingImageUrl` once D is `Done` and confirm it loads (optional; otherwise placeholder `canvas-2` boxes).
Record anything surprising in `plans/PROJECT-FINDINGS.md`.

## 8. Manual testing and owner items

| ID | Who | When needed | Steps (summary) | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| SO-03 (existing) | Native German speaker | Before release | Review `messages/de-DE.json` | Corrections or approval | TODO |
| SO-x (E1) | Owner or designer | Before release | Look at `/en-US/dev/design` icons section: approve or redraw the `cup`, `bean`, `capsule`, `machine` glyphs (Q-E-5) | Approval or new path data | TODO |
| M-E-01 | Owner | Optional, after E is Ready for review | Open the kitchen-sink page on a real phone and a desktop; compare with the VELA screenshots in `design/export/.../screenshots` for the atoms (buttons, chips, fields, stepper, steps) | "Looks like the design" or a list of differences | TODO |
| M-E-02 | Owner | Before release | Confirm the two token value changes for contrast (`--ink-3` from `#7C7975` to `#6E6B67`, Q-E-1) and the new text tokens `--teal-text`, `--danger-text` | Approval or "keep VELA value, accept AA failure" | TODO |

Full rows in `plans/notes/todo-E.md`.

## 9. Questions (default is built)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-E-1 | The VELA muted text colour `--ink-3 #7C7975` has contrast 4.12 on canvas and 3.81 on canvas-2 (WCAG AA needs 4.5). Also teal text (2.28 on white) and danger text (3.91) fail. | Change the **value** of `--ink-3` to `#6E6B67`; add `--teal-text` and `--danger-text`; teal is never used for small text; names unchanged | no |
| Q-E-2 | Fonts: `next/font/google` (build-time download, self-hosted) or committed local font files? | `next/font/google`; switch to `next/font/local` only if the build machine cannot reach Google Fonts | no |
| Q-E-3 | Spacing scale: Tailwind default 4px step with the rule "layout in multiples of 8"? | Yes, `--spacing` untouched | no |
| Q-E-4 | Breakpoint names in Tailwind (`xs 520`, `narrow 700`, `mobile 820`, `stack 900`, `grid3 1080`) and `max-*` variants (strictly below the width). | As listed; the 1px inclusive/exclusive difference to the prototype is accepted | no |
| Q-E-5 | New coffee glyphs `cup`, `bean`, `capsule`, `machine`: drawn by the team as 24px, 1.75 stroke, round caps. | Starter paths in this file; owner or designer may replace the path data (SO-x) | no |
| Q-E-6 | Toast: E builds it (spec atom) and F mounts it (dependency plan lists it under F). | E builds `ToastProvider` and `useToast`; F mounts | F |
| Q-E-7 | Machine colour swatch values. | `black #1C1B1F`, `white #F7F7F5`, `red #B3262B`, `silver #B8BCC2`, `cream #EADFC8` as tokens `--swatch-*`; unknown key falls back to `--swatch-fallback` | H |
| Q-E-8 | Footer text colours. | `--footer-heading`, `--footer-link`, `--footer-meta` tokens; the prototype's `#7979D1` meta text (4.41 on ink) becomes `#8F8FFF` (6.08) | F |
| Q-E-9 | Dev kitchen-sink page `app/[locale]/dev/design` for self-verification. | Yes; 404 in production; the predeploy check fails while it exists; deleted in Q | no |
| Q-E-10 | Overlay colour: spec says "42% ink"; the prototype uses `rgba(14,13,41,0.42)` (a darker navy). | `color-mix(in srgb, var(--ink) 42%, transparent)` (spec wins) | no |
| Q-E-11 | Focus indicator: the spec only names the field ring (accent 14%), which is too faint to count as a focus indicator. | Global `:focus-visible` 2px accent outline offset 2px on every control, plus the 14% ring on fields | no |
| Q-E-12 | Entrance animation: wrap in `no-preference` and keep transform-only (as the prototype) or drop entirely? | Keep as the prototype; no opacity in keyframes | no |
| Q-E-13 | Catalogue wording choices: "bag" (not "basket" or "cart") in all three languages; en-GB uses "Colour". | As stated; the German words are reviewed under SO-03 | no |
| Q-E-14 | Rating atom: one star plus number and count (the design), not five stars. | One star; a five-star display for the review list and the write form is built in M | M |
| Q-E-15 | Radius token naming. | `--radius-pill|field|card|panel|hero` (the spec names the values, not the names) | no |

Also in `plans/notes/questions-E.md`.

## 10. Definition of done

- E-01 to E-12 ticked, each with a passing `npm run check` commit; `npm run build` passes (fonts download at build; a failure there is a Q-E-2 case).
- Every scenario in section 5 has its named test or evidence.
- `grep -rnE "#[0-9a-fA-F]{3,8}\b" storefront/components storefront/app --include=*.tsx` prints nothing (hex only in `tokens.css`).
- Evidence in `plans/evidence/E/`: kitchen-sink screenshots at 375 and 1440, icons screenshot, focus screenshot, `E-computed-styles.json`, `E-lighthouse.json`, `README.md`.
- Console and network clean on the kitchen-sink page.
- All three catalogues have identical keys; German reviewed or `SO-03` row present.
- No new package added to `package.json` beyond A's list.
- Rows added to `plans/TODO-MANUAL-TESTING.md`, questions to `plans/QUESTIONS.md` (lead merges the notes).
- `node plans/verify-plan.mjs` passes; `STATUS.md` row E is `Ready for review`.
