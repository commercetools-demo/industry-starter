# H — Design system primitives and site chrome

**Specs:** `malva-storefront-design/storefront-design-system` (Rounded/washed, Themed interaction states, Shared component set, Site chrome, Layout and motion, Responsive behavior), `storefront-styling-foundation` (Product image handling)
**Depends on:** B, C, D, E · **Unblocks:** I, J, K, L, M, O, P, X · **Decisions:** D-021 (nav: Shop, New in, Journal), SO-01
**Source:** `design/source/MALVA Web.dc.html` (header/footer/toast/tile markup), `design/DESIGN.md`.

## Goal
Reusable accessible React components that apply the Organic classes from C, plus the site header/footer, with no data fetching.

## Design
All in `site/components/`. Server Components unless marked **(client)**. Props are plain data; no function props from server components.

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `ui/Button.tsx` | props `variant: 'primary'|'secondary'|'ghost'`, `size?: 'icon'`, `block?`, renders `<button>` or `<Link>` when `href` given; classes `btn btn-…` |
| `Tag` | `ui/Tag.tsx` | `tone: 'accent'|'accent-2'|'neutral'|'outline'` |
| `Field`, `Input`, `Textarea`, `Select` | `ui/Field.tsx` | label + control + error; `aria-invalid`, `aria-describedby` wiring; `useId` |
| `Radio`, `Segmented` **(client)** | `ui/Radio.tsx`, `ui/Segmented.tsx` | real `<input type=radio>`; `Segmented` options `{value,label,disabled?}`, `onChange` |
| `Card` | `ui/Card.tsx` | `elev?: 'sm'|'md'|'lg'`, subcomponents `CardKicker/Title/Meta` |
| `Photo` | `ui/Photo.tsx` | `next/image` (`fill`, required `sizes`, `alt`, optional `priority`), wrapper class `washed`, rounded `lg×1.15`; empty `src` → neutral placeholder block |
| `SectionHeading` | `ui/SectionHeading.tsx` | kicker (h6) + h2 + optional link ghost button |
| `QuantityStepper` **(client)** | `ui/QuantityStepper.tsx` | `value`, `min=1`, `max?`, `onChange`; buttons `aria-label` from props (`decreaseLabel`, `increaseLabel`); disables at limits |
| `HeartButton` **(client)** | `ui/HeartButton.tsx` | `pressed`, `onToggle`, `label`; `aria-pressed`; fills `currentColor` + accent when pressed |
| `Table` | `ui/Table.tsx` | themed header/rows |
| `Dialog` **(client)** | `ui/Dialog.tsx` | `open`, `onClose`, `title`; `role=dialog aria-modal`, focus trap, Esc closes, restores focus, backdrop click closes |
| `Blob` | `ui/Blob.tsx` | decorative circle (`aria-hidden`) |
| `Toast` system **(client)** | `ui/Toast.tsx` | `ToastProvider` + `useToast().show({ message, actionLabel?, onAction?|href? })`; fixed bottom-right card `elev-lg`; auto-dismiss **2800 ms**; `role=status aria-live=polite` |
| `Container` | `layout/Container.tsx` | class `.page` |
| `AnnouncementBar` | `layout/AnnouncementBar.tsx` | text from messages (`common.announcement`) |
| `Header` | `layout/Header.tsx` | wordmark link, primary nav (Shop → `/shop`, New in → `/shop?sort=newest`, Journal → `/journal`), search pill link to `/search`, saved link (heart) → `/account/saved`, slots `bag: ReactNode` and `account: ReactNode` (provided by J and O), `LocaleSwitcher`; sticky `top-0`, bg `color-mix(92%)` + `backdrop-blur-[10px]`; active item (`aria-current="page"`) accent + 2px underline |
| `CompactNav` **(client)** | `layout/CompactNav.tsx` | below `tablet` breakpoint: menu button opens a `Dialog`-style drawer with the same links + search |
| `LocaleSwitcher` **(client)** | `layout/LocaleSwitcher.tsx` | `Segmented` of markets from `COUNTRY_CONFIG`; on change `POST /api/locale` then `router.replace(pathname, { locale })` + `router.refresh()` |
| `Footer` | `layout/Footer.tsx` | surface band, 4-col grid: brand blurb + Shop, House, Help columns (links to `/shop?category=…`, `/about`, `/journal`, `/faq`, `/policies/delivery`, `/contact`) |

Breakpoints: add to `globals.css` `@theme { --breakpoint-tablet: 48rem; --breakpoint-desktop: 75rem; }` (utilities `tablet:` `desktop:`) matching the spec (768 / 1200). Header shows the full nav at `desktop`, `CompactNav` below.

Compose in `app/[locale]/layout.tsx` using the provider order defined in D (`NextIntlClientProvider` > `SWRConfig` > `ToastProvider` > `CartProvider` > chrome): `AnnouncementBar` → `Header` → `<main className="page-enter">` → `Footer`. `LocaleSwitcher` receives `markets` = `Object.values(COUNTRY_CONFIG)` for now (G-08 switches the layout to `getValidMarkets()`).

## Tasks
- [x] H-01 Add breakpoints to `globals.css`; write `Icon` (Lucide wrapper `components/ui/Icon.tsx`: stroke width 2.75, `aria-hidden`, `size` prop), `Button`, `Tag`, `Blob`, `Container`, `Card` (+ sub parts) with tests (variant → class; link rendering; disabled → `disabled` attribute and no click).
- [x] H-02 Write `Field`/`Input`/`Textarea`/`Select` with tests (label association; error → `aria-invalid`, `aria-describedby` points to error id and error text visible).
- [ ] H-03 Write `Radio` and `Segmented` with tests (keyboard arrow keys change selection natively; `onChange` called once; disabled option not selectable).
- [ ] H-04 Write `QuantityStepper` and `HeartButton` with tests (min 1 clamp; max disables +; `aria-pressed` toggles; accessible names from props).
- [ ] H-05 Write `Photo` with tests (washed class applied; empty src → placeholder; `alt` required by type; `sizes` passed).
- [ ] H-06 Write `Dialog` with tests (focus moves into dialog; Tab cycles inside; Esc calls `onClose`; focus returns to trigger; backdrop click closes).
- [ ] H-07 Write `Toast` system with fake timers: appears with message and action; auto-dismiss after exactly 2800 ms; second toast replaces first.
- [ ] H-08 Write `SectionHeading`, `Table`, `AnnouncementBar` (tests: kicker/heading/link; table header semantics).
- [ ] H-09 Write `Header`, `PrimaryNav` (**client leaf**, `components/layout/PrimaryNav.tsx`: uses `usePathname`/`useSearchParams` to set `aria-current` — the rest of `Header` stays a Server Component), `CompactNav`, `LocaleSwitcher` (receives a `markets` prop; calls the hook `hooks/useLocaleSwitch.ts`, never `fetch` directly), `Footer` with tests: nav items from messages in both locales; active item has `aria-current`; slots render; locale switch calls `/api/locale` (mock fetch) and router; footer links locale-aware (`getPathname`).
- [ ] H-10 Compose the chrome in `app/[locale]/layout.tsx`; add message keys (both locales) for every string; update `test/utils.tsx` so `renderWithProviders` also includes `ToastProvider`. Report manual tests M-H-1…M-H-4 and sign-off SO-01.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Product photo (rounded + washed) | H-05 |
| Keyboard focus / Disabled control | H-01 (disabled), C-05 CSS test |
| Product tile (shape) | built in K using these parts; shape tested in K |
| Bag count (label) | J (`BagButton`) |
| Add-to-bag toast (2.8 s) | H-07 |
| Reduced motion | C-05 |
| Tablet filters collapse | K |

## Manual tests to report
- M-H-1: Open `/en-US` at 1440 px: header, nav, footer match `design/source/MALVA Web.dc.html` rendered in Claude Design (side-by-side).
- M-H-2: Resize to 1000 px and 390 px: header switches to compact nav; menu opens/closes with keyboard.
- M-H-3: Switch language with the locale switcher: URL prefix, texts and `<html lang>` change.
- M-H-4: Tab through the header: visible focus ring on every control.

## Definition of done
All components documented above exist with tests; no hex colours; no data fetching; sign-off SO-01 requested.
