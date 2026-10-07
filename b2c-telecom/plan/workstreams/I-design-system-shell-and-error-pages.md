# I — Design system primitives, shell and error pages

**Specs:** `storefront-shell` (all six scenarios; the connected bundle count is wired by M, everything else is built here), `error-pages` (all three scenarios). Design reference: `design/DESIGN.md`, `design/specs/shell.md`.
**Depends on:** C, D, E, H · **Unblocks:** M, N, O, P, R, W, Y · **Decisions:** D-003, D-004, D-005, D-050, D-051, D-052, D-053, D-059
**Owner prerequisites:** none for unit tests; OA-02 for the live checks · **Skill refs:** `commercetools-storefront` (header/session patterns)

## Goal
Every page has the same accessible frame: sticky header with category navigation read from the category tree, session-resolved account link and bundle pill, working footer, language switch, a designed mobile drawer below 768 px; a reusable primitives kit; and three recovery pages (not found, server error, unauthorized) plus a global fallback.

## Design

### 1. Files (all new, I's area unless stated)
| Path | Kind |
| --- | --- |
| `lib/cx.ts` | class-name joiner `cx(...parts: (string | false | null | undefined)[]): string` |
| `lib/nav.ts` | `NavItem`, `buildNavItems(tree, locale)`, `activeNavKey(pathname, items)` (pure) |
| `lib/bundle-count.ts` | `countBundleLines(lines)` (pure; M calls it) |
| `lib/auth/guards.ts` | `loginUrl`, `sanitizeNext`, `requireSession`, `unauthorizedUrl` |
| `components/ui/Icon.tsx` | inline SVG icons (no icon package): `MenuIcon`, `CloseIcon`, `CheckIcon`, `ChevronRightIcon`, `SpinnerIcon` (props `{ className?: string }`, `aria-hidden`, `focusable="false"`, `currentColor`) |
| `components/ui/Button.tsx`, `Pill.tsx`, `Chip.tsx`, `Card.tsx`, `Field.tsx`, `QuantityStepper.tsx`, `Toast.tsx`, `Breadcrumb.tsx`, `Tag.tsx`, `Skeleton.tsx` | primitives (§2) |
| `components/layout/SiteHeader.tsx`, `NavPill.tsx`, `AccountLink.tsx`, `BundlePill.tsx`, `LocaleSwitcher.tsx`, `MobileDrawer.tsx`, `SiteFooter.tsx` | shell (§3) |
| `components/errors/ErrorView.tsx` | one component, three kinds (§5) |
| `app/[locale]/layout.tsx` | **edits** D's file: provider order and chrome composition (§4) |
| `app/[locale]/not-found.tsx`, `app/[locale]/error.tsx`, `app/[locale]/unauthorized/page.tsx`, `app/[locale]/[...rest]/page.tsx`, `app/not-found.tsx`, `app/global-error.tsx`, `app/[locale]/dev/error/page.tsx` | error pages (§5) |
| `test/utils.tsx` | **edits** A/D's file: `renderWithProviders` also wraps `ToastProvider` |
| `messages/en-US.json`, `messages/de-DE.json` | **appends** the keys of §6 |
| `lib/contrast.test.ts` | token contrast test (§7) |

### 2. Primitives (`components/ui/*`)
Rules for all: tokens only (Tailwind classes generated from the C `@theme`; no hex, no `px` literal, no font name); every interactive element has a **visible focus ring**: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action` (on `brand-*` surfaces: `focus-visible:outline-brand-950`); touch targets are at least `min-h-11` (44 px) for anything a thumb presses; disabled = `disabled` attribute and `opacity-50 cursor-not-allowed`; Server Components unless marked client. Visual spec comes from `design/DESIGN.md` principles 1-4 and `design/specs/plp.md`.

| Component | Props and behaviour |
| --- | --- |
| `Button` | `variant: 'primary' \| 'secondary' \| 'dark' \| 'ghost'` (default `primary`), `size: 'md' \| 'sm'` (`md` = `min-h-11 px-6`, `sm` = `min-h-9 px-4`), `pressed?: boolean` (toggle CTA: sets `aria-pressed`, renders the filled look), `loading?: boolean` (disables, `aria-busy`, shows `SpinnerIcon`), `href?: string` (renders the locale-aware `Link` from `@/i18n/routing`, same classes), `block?: boolean`, plus native button/anchor attributes. Look: pill (`rounded-pill`), font `font-cta` weight 800, `text-md`. `primary` = `bg-action text-on-pink hover:bg-action-hover`; `secondary` = transparent, `border-2 border-action text-action`, hover `bg-pink-50`; `pressed` secondary = same as primary; `dark` = `bg-brand-950 text-neutral-0` (white is allowed on brand-950); `ghost` = `text-link underline-offset-4 hover:underline`. |
| `Pill` | Exo 600 `text-sm`, `tracking-ui`, `rounded-pill`, `px-5 py-3`; `active?: boolean` (active = `bg-brand-950 text-neutral-0`, inactive on brand surface = transparent `text-on-brand` with `hover:bg-brand-400`); `as: 'link' \| 'button'`; `href`; `aria-current` set by the caller. |
| `Chip` **(client)** | filter chip: `selected: boolean`, `count?: number`, `onClick`, children; `<button type="button" aria-pressed={selected}>`; default `bg-brand-100 text-brand-950`, hover `bg-brand-200`, selected `bg-brand-950 text-neutral-0`; Exo 600 `text-sm`. |
| `Card`, `CardHeader`, `CardBody` | `Card` = `rounded-xl border border-border bg-surface`; `CardHeader tone: 'brand' \| 'pink' \| 'plain'` (`brand` = `bg-brand-500 text-on-brand`, `pink` = `bg-pink-900 text-neutral-0`) with `p-7`; `CardBody` `p-7 flex flex-col gap-5`. Optional `as` (`div`/`article`/`li`). |
| `Field`, `Input`, `Select`, `Textarea` | `Field({ label: string, htmlFor?: string, hint?: string, error?: string, children })`: label (Exo 600 `text-sm`), control, hint, error. Inputs: `rounded-pill border border-neutral-400 bg-surface px-6 min-h-11 text-md`, Textarea `rounded-lg`. Wiring via `useId`: `aria-describedby` = hint id and error id, `aria-invalid` when `error`, error text `text-danger` (`--color-danger` from C's extension block) with `role="alert"` only when it appears after submit (prop `errorLive?: boolean`). Focus: `focus-visible:outline-2 outline-offset-2 outline-action` (a ring, not a color change only). |
| `QuantityStepper` **(client)** | `value: number`, `min = 1`, `max = 5`, `onChange(n)`, `decreaseLabel`, `increaseLabel`, `valueLabel` (strings from the caller, never hard-coded); `role="group"`; two 44 px round buttons and a value in `aria-live="polite"`; buttons `disabled` at the limits; clamps typed/forced values into `[min, max]`. |
| `Toast` system **(client)** | `ToastProvider` + `useToast()` returning `{ show(t: { message: string; tone?: 'success' \| 'error'; actionLabel?: string; href?: string }): void; dismiss(): void }`. One toast at a time (a second replaces the first); auto-dismiss **4000 ms** (`TOAST_MS` exported); region `role="status" aria-live="polite"` always mounted; bottom-right on `md` and up, bottom-center full width minus `space-5` below; a close button with `aria-label` from `useTranslations('common')` (`common.toast.dismiss`); `shadow-lg rounded-lg`; `success` = `bg-brand-950 text-neutral-0`, `error` = `bg-danger text-neutral-0`; pausing the timer while hovered or focused. |
| `Breadcrumb` | `items: { label: string; href?: string }[]`, `nav aria-label` from `useTranslations('common')` (`common.breadcrumb`), `ol`, separator "/" with `aria-hidden`, last item `aria-current="page"` (not a link). Exo 500 `text-sm`, colour `text-brand-900` (NOT `brand-800`: `brand-800` on `brand-100` is 4.2:1 and fails AA). |
| `Tag` | `tone: 'brand' \| 'pink' \| 'neutral' \| 'danger'`; Exo 600 `text-xs`, uppercase, `tracking-ui`, `rounded-pill px-3 py-1`; `brand` = `bg-brand-100 text-brand-950`, `pink` = `bg-pink-50 text-pink-800`, `neutral` = `bg-neutral-100 text-text`, `danger` = `bg-danger text-neutral-0`. |
| `Skeleton` | `className` (width/height utilities), `aria-hidden`, `rounded-md bg-neutral-100 motion-safe:animate-pulse`. |

### 3. Shell (`components/layout/*`), per `design/specs/shell.md`
- **`SiteHeader` (Server Component, async)**: props `{ locale: Locale; account: ReactNode; bundle: ReactNode }` (the two slots are provided by `layout.tsx`; M later replaces the `bundle` slot with the connected pill). Reads the tree with `getCategoryTree(locale)` wrapped in try/catch: on failure it logs `console.error('[shell] category tree unavailable')` and renders **without** nav items (wordmark and slots still render), so a catalog outage never takes the header down. `<header className="sticky top-0 z-10 bg-surface-brand text-on-brand shadow-sm">`; inner container `mx-auto max-w-[var(--container-width)] px-9 py-5 flex items-center gap-8` (use `max-w-container` if C maps it in `@theme`; otherwise the token var; no `1440px` literal). Wordmark "malva" (Exo 700 `text-4xl`, 2 px letter-spacing: use the wordmark tracking class C defines in its extension block, else `tracking-widest`; colour `text-brand-950`), `Link href="/"`, `aria-label` "Malva Telecom home" (`shell.home`). Desktop nav `<nav aria-label={shell.nav.primary} className="hidden md:flex flex-1 gap-2">` with one `NavPill` per root category (all roots of the tree, order as returned by H: 5 pills when the devices category exists). Right cluster: `LocaleSwitcher` (desktop only), `account` slot, `bundle` slot. Below `md` (767 px and less): only wordmark, `bundle` slot and the `MobileDrawer` menu button are visible.
- **`NavPill` (client leaf)**: props `{ item: NavItem; items: NavItem[] }`; uses `usePathname` from `@/i18n/routing`; `active = activeNavKey(pathname, items) === item.key`; renders `Pill` as link to `item.path`, `aria-current={active ? 'page' : undefined}`; active look = dark pill (`bg-brand-950 text-neutral-0`), inactive transparent.
- **`lib/nav.ts`**:
  ```ts
  export interface NavItem { key: string; label: string; path: string /* e.g. /shop/cable-internet (no locale) */; matchSlugs: string[] /* slugs of the root and ALL descendants, in every locale */ }
  export function buildNavItems(tree: Category[], locale: Locale): NavItem[];            // one per root, same order as the tree
  export function activeNavKey(pathname: string, items: NavItem[]): string | undefined;  // pathname without locale prefix
  ```
  `activeNavKey`: matches `^/shop/([^/?#]+)`; the slug is looked up in `matchSlugs` (so a child category and the add-ons listing `/shop/add-ons` highlight "Add-ons"); any other path returns `undefined`; a trailing slash is ignored; the query string (`?offer=…`) is not part of `pathname`.
- **`AccountLink` (Server Component, async, `[MIDDLEWARE]`)**: reads the session per request: `const session = await getSession()` from `@/lib/ct/session` (E; ARCHITECTURE lists this module; if E exported it under another path, change the one import). Required shape from E: `{ customerId?: string; firstName?: string }`. Signed in (`customerId` present): link to `/account` with text `shell.account.greeting` (`Hi, {firstName}`; if `firstName` is empty use `shell.account.greetingNoName` = `My account`); anonymous: link to `/login`, text `shell.account.login` (`Log in`). Style: Exo 600 `text-sm tracking-ui`, `max-w-40 truncate`. It is **never** cached and never wrapped in `unstable_cache`; `layout.tsx` wraps it in `<Suspense fallback={<Skeleton className="h-5 w-20" />}>` so the page shell streams without waiting.
- **`BundlePill` (presentational)**: props `{ count: number }`; link to `/bundle`; text `shell.bundle.labelCount` = `My bundle · {count}` (U+00B7 with spaces); accessible name the same; `bg-brand-950 text-neutral-0 rounded-pill px-6 py-3 Exo 600 text-sm`. Default slot value in `layout.tsx` until M: `<BundlePill count={0} />`. M replaces it with a client component that reads the cart and calls `countBundleLines`.
- **`countBundleLines(lines: { offerKind: OfferKind }[]): number`** in `lib/bundle-count.ts`: counts **line items** (not quantity: a phone plan with quantity 3 is one entry) whose `offerKind` is `base-package`, `addon`, `bundle` or `device`; **equipment lines are not counted** (they are part of a plan). So "two plans and one add-on" = 3. (Planner default for the spec's "line items vs total quantity" question.)
- **`LocaleSwitcher` (client)**: props `{ current: Locale }`; renders a group `role="group" aria-label={shell.locale.label}` of two buttons `EN` / `DE` (full names in `aria-label`: `shell.locale.en-US` "English (US)", `shell.locale.de-DE` "Deutsch (Deutschland)"), the current one `aria-pressed="true"`. On click it calls D's hook `useLocaleSwitch` (D's workstream owns `POST /api/locale` and the router replace; do not call `fetch` here; if D named the hook differently, use D's name and note it in the task commit). Placement: right cluster on desktop; inside the drawer on mobile. This control is not drawn in the prototype; Junior design choice (D-068): place it from tokens and `components/ui`; document the choice here.
- **`MobileDrawer` (client)**: undrawn: **Junior design choice** (D-068), designed from tokens and `components/ui`, rationale in one line in the PR/commit message. Props `{ items: NavItem[]; account: ReactNode; bundle: ReactNode; locale: Locale }`. Visible only `md:hidden`.
  - Menu button: pill `bg-brand-950 text-neutral-0 min-h-11 min-w-11`, `MenuIcon`, `aria-label={shell.menu.open}`, `aria-expanded`, `aria-controls="mobile-drawer"`.
  - Open state: backdrop `fixed inset-0 bg-brand-950/50` (click closes); panel `id="mobile-drawer" role="dialog" aria-modal="true" aria-label={shell.menu.title}` `fixed inset-y-0 right-0 w-[88vw] max-w-sm bg-surface shadow-lg rounded-l-xl flex flex-col gap-5 p-7 overflow-y-auto`; top row: wordmark and a close button (`CloseIcon`, `aria-label={shell.menu.close}`, `min-h-11 min-w-11`); then one full-width `Pill` link per `NavItem` (`min-h-12`, active = dark pill, `aria-current="page"` via `activeNavKey`); a hairline `border-t border-border`; the `account` slot; `LocaleSwitcher`. The bundle pill stays in the header (always visible), not in the drawer.
  - Behaviour: on open, focus moves to the close button; **Tab/Shift+Tab cycle inside** the panel; `Esc` closes; backdrop click closes; following a link or a route change closes it (effect on `usePathname`); on close, focus returns to the menu button; `document.body` gets `overflow-hidden` while open and it is restored on close and on unmount; the panel slides in over 200 ms (`transition-transform duration-200 motion-reduce:transition-none`, mounted with `translate-x-full` and moved to `translate-x-0` in an effect on the next frame); no exit animation (it unmounts).
- **`SiteFooter` (Server Component, async)**: `<footer className="bg-brand-950 text-brand-100 py-9">`; left wordmark (Exo 700 `text-3xl`, `text-brand-500`); centre `<nav aria-label={footer.nav}>` with one `Link` per root category (label = category name, `href = /shop/<slug>`) and a final **Support** link to `/support` (D-051; the page is built by W; until then it is a 404, accepted); right `footer.copyright` ("© 2026 Malva Telecom", Roboto `text-sm`, `text-brand-300`); optional prop `credits?: ReactNode` rendered under the row (image credit line required by D-055; the content is supplied by the workstream that owns the credits). Same try/catch as the header: tree failure renders the Support link and copyright only. Links are real `Link`s (the prototype had plain text).
- Skip link: first focusable element of the page, `<a href="#main">` text `shell.skipToContent`, visually hidden until focused (`sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-20 focus:rounded-pill focus:bg-brand-950 focus:text-neutral-0 focus:px-6 focus:py-3`).

### 4. Layout composition and provider order (`app/[locale]/layout.tsx`, D's file, edited here)
```tsx
<NextIntlClientProvider locale={locale} messages={messages}>     {/* D */}
  <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 2000 }}>   {/* I adds if D did not */}
    <ToastProvider>                                              {/* I */}
      {/* M inserts <CartProvider> here, wrapping everything below */}
      <a className="skip-link" href="#main">…</a>
      <SiteHeader locale={locale}
        account={<Suspense fallback={<Skeleton className="h-5 w-20" />}><AccountLink /></Suspense>}
        bundle={<BundlePill count={0} />} />
      <main id="main" tabIndex={-1} className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </ToastProvider>
  </SWRConfig>
</NextIntlClientProvider>
```
`<html lang={locale}>` is D's. Page = flex column `min-h-screen` (on `body`, C's base styles). Pitfall: `AccountLink` reads `cookies()`, which makes every page under this layout dynamic; accepted (the session-specific frame must not come from cached content). Shared catalog data inside (the tree) is still cached by H.

### 5. Error pages (`error-pages`): one component, three kinds
`components/errors/ErrorView.tsx` (no hooks except `useTranslations`/`useLocale`; renders in Server and Client trees): `ErrorView({ kind: 'not-found' | 'unauthorized' | 'server', reference?: string, onRetry?: () => void })`. Layout: centered column `max-w-2xl mx-auto py-9 px-9 flex flex-col gap-7`; kicker `Tag tone="brand"` ("404" / "403" / "500"); `<h1>` Exo 700 `text-4xl`; body Roboto `text-lg text-text-muted`; actions row.
- `not-found`: title/body from `errors.notFound.*`; **search entry point**: `<form role="search" action="/{locale}/search" method="get">` with a labelled input (`name="q"`, label `errors.notFound.searchLabel`) and a `Button` submit (works without JavaScript; the page `/search` is built by P); **top-level navigation** is the site header (rendered by the layout) plus, in the body, links to every root category (try/catch around `getCategoryTree`; on failure the links are omitted); primary action `Button href="/"` `errors.home`.
- `server`: title/body `errors.server.*`; actions: `Button` "Try again" (`onRetry`) and a `secondary` `Button href="/"` home; optional `Reference: {reference}` line (Next's `error.digest`). Never prints `error.message`.
- `unauthorized`: title/body `errors.unauthorized.*`; actions: "Go to my account" (`/account`), "Contact support" (`/support`); the `reference` line is how the buyer quotes the refusal to support.
Files:
- `app/[locale]/not-found.tsx` (Server): renders `ErrorView kind="not-found"`; the 404 status comes from Next when `notFound()` is thrown; **it renders inside the normal layout** (header, nav, footer) because it is a segment-level boundary, so the page is complete, never a partial shell.
- `app/[locale]/[...rest]/page.tsx`: `export default function CatchAll() { notFound(); }` so every unmatched `/<locale>/…` URL (including a product-detail-shaped one, D-052) gets the localized 404.
- `app/not-found.tsx` (root, for URLs outside any locale; static, no intl provider): bilingual static copy "Page not found · Seite nicht gefunden" and a plain `<a href="/">`; no data calls.
- `app/[locale]/error.tsx` (client): `({ error, reset })`; `useEffect(() => console.error('[error-boundary]', error.digest ?? '', error), [error])`; renders `ErrorView kind="server" reference={error.digest} onRetry={reset}`. It performs **no** session or cart mutation and no fetch: the header/footer around it still render from the cookie (the buyer stays signed in, the bundle count is unchanged).
- `app/global-error.tsx` (client): `import './globals.css'`; own `<html lang="en"><body>`; **static bilingual copy**, no `useTranslations`, no session, no catalog call; heading "Something went wrong · Etwas ist schiefgelaufen", a `Try again · Erneut versuchen` button (`reset`) and a link to `/`. It is what remains when the layout itself fails.
- `app/[locale]/unauthorized/page.tsx` (Server): `export const metadata = { robots: { index: false } }`; reads `searchParams.ref`, accepts it only if it matches `/^[A-Za-z0-9-]{4,32}$/`; renders `ErrorView kind="unauthorized"`. HTTP status is 200 (a route page cannot set 403 without the experimental `forbidden()` API, which we do not enable).
- `app/[locale]/dev/error/page.tsx`: development-only trigger for the server-error page: first line `if (process.env.NODE_ENV !== 'development') notFound();` then `throw new Error('boom-test')`.
- `lib/auth/guards.ts`:
  ```ts
  export function sanitizeNext(next: string | null | undefined): string;                // returns a same-site path starting with a single "/" (max 512 chars, no "//", no "\", no scheme, no control chars) else "/account"
  export function loginUrl(locale: Locale, destination: string): string;                // `/${locale}/login?next=${encodeURIComponent(sanitizeNext(destination))}`
  export function unauthorizedUrl(locale: Locale, reference?: string): string;          // `/${locale}/unauthorized` (+ `?ref=…` only if reference matches the safe pattern)
  export async function requireSession(locale: Locale, destination: string): Promise<{ customerId: string }>;  // no session/customerId (expired or never signed in): redirect(loginUrl(...)); else returns it
  ```
  `requireSession` uses `redirect` from `@/i18n/routing`'s navigation helpers or `next/navigation` exactly as D defines for server redirects and is **never** inside try/catch. R's login page reads `next` and must call `sanitizeNext` (R's task; interface noted in the report). S/T pages call `requireSession` at the top.

**Answers to the three `error-pages` open questions (Planner defaults):**
1. *Does the unauthorized page show the missing permission name?* **No.** It shows only a short reference. There are no associates, roles or business units in this B2C store (D-005), so a permission vocabulary does not exist; platform error text is never shown (it can carry identifiers). A signed-in buyer who asks for another customer's order, address or list gets the **not-found** page, not "unauthorized" (does not reveal that the resource exists); `unauthorized` is reserved for an action the signed-in account itself is not allowed to take (S/T/V decide when; none is required in v1).
2. *May the server-error page be served from the CDN if the middleware tier failed?* **No special CDN page.** `error.tsx` lives inside the layout (needs the app); `global-error.tsx` is the self-contained fallback and is static markup that needs no session or catalog call, so it renders even during an upstream outage. Netlify serves it from the same Next runtime; no separate static `500.html` in v1.
3. *Soft 404 vs redirect?* **Always a real 404 with recovery content** (search box, category links, home). No redirects for retired offers: a link `…/shop/<category>?offer=<retired key>` opens the category normally (N ignores an unknown `offer`); an unknown category slug is a 404. The only redirect is slug-of-another-locale to the canonical slug (N).

### 6. Message keys (add to both files; German is a faithful translation)
| Key | en-US | de-DE |
| --- | --- | --- |
| `shell.home` | Malva Telecom home | Malva Telecom Startseite |
| `shell.skipToContent` | Skip to content | Zum Inhalt springen |
| `shell.nav.primary` | Main navigation | Hauptnavigation |
| `shell.account.login` | Log in | Anmelden |
| `shell.account.greeting` | Hi, {firstName} | Hallo, {firstName} |
| `shell.account.greetingNoName` | My account | Mein Konto |
| `shell.bundle.labelCount` | My bundle · {count} | Mein Bundle · {count} |
| `shell.menu.open` | Open menu | Menü öffnen |
| `shell.menu.close` | Close menu | Menü schließen |
| `shell.menu.title` | Menu | Menü |
| `shell.locale.label` | Language and region | Sprache und Region |
| `shell.locale.en-US` | English (US) | English (US) |
| `shell.locale.de-DE` | Deutsch (Deutschland) | Deutsch (Deutschland) |
| `footer.nav` | Footer | Fußzeile |
| `footer.support` | Support | Support |
| `footer.copyright` | © 2026 Malva Telecom | © 2026 Malva Telecom |
| `common.toast.dismiss` | Dismiss | Schließen |
| `common.breadcrumb` | Breadcrumb | Brotkrumenpfad |
| `errors.kicker.notFound` / `errors.kicker.unauthorized` / `errors.kicker.server` | 404 / 403 / 500 | 404 / 403 / 500 |
| `errors.notFound.title` | We couldn't find that page | Diese Seite haben wir nicht gefunden |
| `errors.notFound.body` | The address may be mistyped, or the offer is no longer available. Search, or head back to our plans. | Die Adresse ist vielleicht falsch geschrieben oder das Angebot ist nicht mehr verfügbar. Suchen Sie oder gehen Sie zurück zu unseren Tarifen. |
| `errors.notFound.searchLabel` | Search Malva | Malva durchsuchen |
| `errors.notFound.searchButton` | Search | Suchen |
| `errors.notFound.browse` | Browse our plans | Unsere Tarife ansehen |
| `errors.home` | Back to home | Zur Startseite |
| `errors.server.title` | Something went wrong on our side | Bei uns ist etwas schiefgelaufen |
| `errors.server.body` | We couldn't finish loading this page. Your bundle and your sign-in are safe. Please try again. | Wir konnten diese Seite nicht vollständig laden. Ihr Bundle und Ihre Anmeldung sind unverändert. Bitte versuchen Sie es erneut. |
| `errors.server.retry` | Try again | Erneut versuchen |
| `errors.reference` | Reference: {reference} | Referenz: {reference} |
| `errors.unauthorized.title` | You don't have access to this | Dafür fehlt Ihnen die Berechtigung |
| `errors.unauthorized.body` | You're signed in, but your account isn't allowed to do this. If you think that's a mistake, contact support and quote the reference below. | Sie sind angemeldet, aber Ihr Konto darf das nicht. Falls Sie das für einen Fehler halten, wenden Sie sich an den Support und nennen Sie die Referenz. |
| `errors.unauthorized.account` | Go to my account | Zu meinem Konto |
| `errors.unauthorized.support` | Contact support | Support kontaktieren |

### 7. Contrast and accessibility requirements (testable)
`lib/contrast.test.ts` reads `design/source/_ds/tokens.css`, resolves the named tokens and computes WCAG relative-luminance ratios. Required minimums (text 4.5:1, focus ring/UI boundary 3:1):
| Foreground / background | Min | Used for |
| --- | --- | --- |
| `--color-text-on-brand` on `--color-brand-500` | 4.5 | header text, nav, brand cards |
| `--color-brand-900` on `--color-brand-100` | 4.5 | breadcrumb, title strips (`brand-800` is NOT allowed here: it computes to about 4.2) |
| `--color-text-on-pink` (white) on `--color-pink-700` | 4.5 | primary CTA |
| white on `--color-brand-950` | 4.5 | active pill, bundle pill, toast |
| `--color-brand-100` on `--color-brand-950` | 4.5 | footer links |
| `--color-brand-300` on `--color-brand-950` | 4.5 | footer copyright |
| `--color-pink-700` on `--color-surface` | 4.5 | links, secondary CTA text |
| `--color-pink-700` on `--color-pink-50` | 4.5 | callouts |
| `--color-text-muted` on `--color-surface` | 4.5 | muted text |
| `--color-danger` (`#a1262b`, C's extension) on `--color-surface` | 4.5 | form errors |
| `--color-pink-700` on `--color-brand-500` | 3.0 | focus ring next to header surfaces (header uses `brand-950` rings: `brand-950` on `brand-500` 3.0) |
If a pair fails, switch the component to the next darker token of the same ramp and note it in the commit; do not change a token value (D-053).
A11y rules: landmarks `banner` (header), `navigation` (each nav labelled), `main#main`, `contentinfo`; one `h1` per page; every icon-only button has an accessible name; focus is never removed (`outline-none` only together with a replacement ring); animations respect `prefers-reduced-motion` (`motion-safe:`/`motion-reduce:`); at 375 px nothing scrolls horizontally (`document.documentElement.scrollWidth <= window.innerWidth`).

### Pitfalls
- `useTranslations` strings in a Server Component must use `getTranslations` (async) — `AccountLink`, `SiteHeader`, `SiteFooter` are Server Components.
- Never pass functions from `SiteHeader` to client leaves (`NavPill`, `MobileDrawer` receive plain data: `NavItem[]`, ReactNode slots are allowed).
- A hydration mismatch appears if `MobileDrawer` reads `window` during render; keep it in effects.
- `notFound()` and `redirect()` throw: no try/catch around them (`requireSession`).
- The header tree read is cached by H (60 s); `AccountLink` must stay outside any cache. Importing `unstable_cache` in a file that calls `getSession()` fails H's guard test.
- `sticky` breaks if an ancestor has `overflow: hidden`; keep `body` free of it (the drawer sets it only while open).
- German strings are longer (about 25 %): the header must not wrap at 1024 px in de-DE (Chrome check).

## Tasks
- [x] I-01 Create `lib/cx.ts`, `components/ui/Icon.tsx`, `Button.tsx`, `Pill.tsx`, `Tag.tsx`, `Skeleton.tsx` with colocated tests: variant to class mapping; `href` renders a link; `disabled` attribute and no click; `pressed` sets `aria-pressed`; `loading` sets `aria-busy` and disables; focus-ring class present on every interactive variant; skeleton `aria-hidden`.
- [x] I-02 Create `components/ui/Chip.tsx`, `Card.tsx`, `Breadcrumb.tsx` with tests: `aria-pressed` toggles and `onClick` once; count rendered; card tone classes; breadcrumb last item is not a link and has `aria-current="page"`, `nav` has the translated label (use `renderWithProviders`).
- [x] I-03 Create `components/ui/Field.tsx` (`Field`, `Input`, `Select`, `Textarea`) with tests: label association (`getByLabelText`); `error` sets `aria-invalid="true"` and `aria-describedby` pointing at visible error text; hint wiring; focus ring class.
- [x] I-04 Create `components/ui/QuantityStepper.tsx` with tests: `min`/`max` disable the buttons; clamps; accessible names from props; `onChange` called with the new value once.
- [x] I-05 Create `components/ui/Toast.tsx` and update `test/utils.tsx` so `renderWithProviders` wraps `ToastProvider`; tests with fake timers: appears with message and action link; auto-dismiss at exactly 4000 ms; second toast replaces the first; hover pauses the timer; `role="status"` region always mounted.
- [x] I-06 Create `lib/nav.ts` and `lib/bundle-count.ts` with `lib/nav.test.ts`, `lib/bundle-count.test.ts`: nav items follow the tree order; `/shop/cable-internet`, `/shop/add-ons`, `/shop/streaming-entertainment` (a child) and the de-DE slug of the same category map to the right root; `/bundle` maps to none; two plans + one add-on = 3; equipment lines are not counted; a phone plan with quantity 3 counts 1.
- [x] I-07 Create `components/layout/AccountLink.tsx` and `BundlePill.tsx` with tests (mock `@/lib/ct/session`): anonymous shows "Log in" linking to `/login`; signed in shows "Hi, Alex" linking to `/account`; empty first name shows "My account"; `BundlePill count={3}` text "My bundle · 3"; de-DE texts.
- [x] I-08 Create `components/layout/NavPill.tsx` and `SiteHeader.tsx` with tests (mock `getCategoryTree`, `@/i18n/routing` `usePathname`): sticky classes (`sticky top-0 z-10`); active pill has `aria-current="page"` and the dark classes, others do not; tree failure still renders wordmark and slots with no nav; four-root fixture renders four pills, five-root fixture five.
- [ ] I-09 Create `components/layout/LocaleSwitcher.tsx` with tests (mock D's `useLocaleSwitch`): current locale `aria-pressed`; click calls the hook with the other locale; accessible names.
- [ ] I-10 Create `components/layout/MobileDrawer.tsx` and wire it in `SiteHeader` with tests: opens on click (`aria-expanded` true, dialog present), focus on close button, Tab cycles inside, Esc closes and focus returns to the menu button, backdrop click closes, route change closes, `body` overflow restored on close and unmount, active item `aria-current`.
- [ ] I-11 Create `components/layout/SiteFooter.tsx` with tests (mock tree): one working link per root category with the right `href`, plus `Support` to `/support`, copyright text, `credits` slot, tree failure still shows Support; de-DE labels.
- [ ] I-12 [SKILL: commercetools-storefront] Edit `app/[locale]/layout.tsx` per §4 (provider order, skip link, `Suspense` around `AccountLink`, `main#main`), add the message keys of §6 for `shell.*`, `footer.*`, `common.*` (both locales), test `app/[locale]/layout.test.tsx` (renders header, main, footer in that DOM order; the provider order `ToastProvider` outside the header so `useToast` works in children).
- [ ] I-13 Create `components/errors/ErrorView.tsx`, `app/[locale]/not-found.tsx`, `app/[locale]/[...rest]/page.tsx`, `app/not-found.tsx`, the `errors.*` message keys (both locales), tests: `not-found` has a `search` form with `action="/en-US/search"`, `name="q"`, and category links; catch-all calls `notFound` (mock `next/navigation`); root not-found has no data calls.
- [ ] I-14 Create `app/[locale]/error.tsx`, `app/global-error.tsx`, `app/[locale]/dev/error/page.tsx` with tests: `error.tsx` never renders `error.message`, shows `Reference: abc123` for `digest: 'abc123'`, "Try again" calls `reset`, makes no `fetch` call and no cookie write; `global-error` renders `<html>`/`<body>` and both languages; dev page returns 404 outside development.
- [ ] I-15 Create `lib/auth/guards.ts` and `app/[locale]/unauthorized/page.tsx` with tests: `requireSession` with no session calls `redirect` with `/en-US/login?next=%2Faccount%2Forders`; `sanitizeNext` rejects `//evil.com`, `https://x`, `/\\x`, over-long and control-character input; `unauthorized` page ignores an invalid `ref`, has `robots` noindex metadata.
- [ ] I-16 Create `lib/contrast.test.ts` (§7 table) and make it pass; run `npm run verify`; run `node plan/verify-plan.mjs --sync`; leave the C-I lines for Claude.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Active category highlighted | `storefront-shell` | `lib/nav.test.ts` → "Active category highlighted: add-ons listing and a child category mark the Add-ons item"; `components/layout/NavPill.test.tsx` → "Active category highlighted: active pill has aria-current and the dark classes, the others do not" |
| Anonymous buyer | `storefront-shell` | `components/layout/AccountLink.test.tsx` → "Anonymous buyer: reads Log in and links to /login"; `components/layout/BundlePill.test.tsx` → "Anonymous buyer: the pill shows the count it is given" (the connected anonymous-bundle count is wired and checked in M: C-M-*) |
| Signed-in buyer | `storefront-shell` | `components/layout/AccountLink.test.tsx` → "Signed-in buyer: reads Hi, Alex and links to /account" |
| Bundle count counts plans and add-ons | `storefront-shell` | `lib/bundle-count.test.ts` → "Bundle count counts plans and add-ons: two plans and one add-on give 3"; `components/layout/BundlePill.test.tsx` → "Bundle count counts plans and add-ons: renders My bundle · 3" |
| Header stays reachable | `storefront-shell` | `components/layout/SiteHeader.test.tsx` → "Header stays reachable: header is sticky at top-0 above content (z-10)" (scroll behaviour: C-I-3) |
| Footer links | `storefront-shell` | `components/layout/SiteFooter.test.tsx` → "Footer links: every item is a link with the category href and Support goes to /support" |
| Address resolves to nothing | `error-pages` | `app/[locale]/not-found.test.tsx` → "Address resolves to nothing: renders search form and category links inside the layout"; `app/[locale]/[...rest]/page.test.tsx` → "Address resolves to nothing: unmatched locale URL calls notFound" |
| Upstream fault | `error-pages` | `app/[locale]/error.test.tsx` → "Upstream fault: shows the server-error page with a retry, never the raw message, and touches neither session nor cart" |
| Expired session is not a refusal | `error-pages` | `lib/auth/guards.test.ts` → "Expired session is not a refusal: no session redirects to sign-in with the destination preserved, not to unauthorized" |

## Chrome verification (run by Claude)
Run with `cd site && npm run dev`, seeded project, OA-02. Console must be clean (no errors or warnings, no hydration warnings) unless stated. "Token" checks use `get_css_styles` on the named element.
- C-I-1 (needs OA-02, G, H): `http://localhost:3000/en-US` at 1440×900, take a snapshot and screenshot → header (brand yellow `#f9c162` background, `box-shadow` present) with wordmark "malva", pills in order Phone plans, Wireless internet, Cable internet, Add-ons, Phones and devices (5th only if the devices category exists), then "Log in" and "My bundle · 0"; no pill active on home; footer dark (`#3e3019`) with the same category links plus "Support" and "© 2026 Malva Telecom"; one `<h1>` per page is N/O's job, not checked here.
- C-I-2 (needs OA-02, G, H, N): `http://localhost:3000/en-US/shop/cable-internet` → only "Cable internet" is the dark pill with white text (`aria-current="page"`); `/en-US/shop/add-ons` → only "Add-ons"; `/en-US/shop/streaming-entertainment` → "Add-ons" active; click each pill and confirm the URL; after N exists these routes render; before N they 404 and this check waits for N.
- C-I-3 (needs OA-02, G, H, N): on `/en-US/shop/cable-internet` scroll 1500 px (`evaluate_script window.scrollTo`) → header `getBoundingClientRect().top === 0` and `position: sticky`; screenshot shows the header above content.
- C-I-4 (needs OA-02, G, H, W): footer links on `/en-US`: click or fetch every footer href → each returns 200 and renders a page (Support returns 404 until W is verified; record "waiting for W" rather than failing I); network shows no failed request except that one.
- C-I-5 (needs OA-02, G, H): keyboard: Tab from the top of `/en-US` → first stop is "Skip to content" (visible, dark pill); Enter moves focus to `main`; Tab through wordmark, each pill, language buttons, Log in, My bundle → each shows a visible 2 px outline with offset (`get_css_styles` `outline-width: 2px`, `outline-style: solid`), none is clipped.
- C-I-6 (needs OA-02, G, H): `http://localhost:3000/de-DE` at 1024×768 → labels "Anmelden", "Mein Bundle · 0", footer "Support", category names in German; header content on one row without wrapping or overflow; `<html lang="de-DE">`; click "EN" in the switcher → URL becomes `/en-US`, texts English, the same page path preserved.
- C-I-7 (needs OA-02, G, H): `http://localhost:3000/en-US` resized to 375×812 → header shows wordmark, "My bundle · 0" pill and a menu button (`aria-label="Open menu"`); desktop nav and language buttons hidden; `document.documentElement.scrollWidth <= 375`; touch targets (menu button, pill) at least 44 px tall (`getBoundingClientRect().height`).
- C-I-8 (needs OA-02, G, H): at 375 px click the menu button → drawer slides in from the right covering ≤ 88 % of the width with a dimmed backdrop, `aria-expanded="true"`, focus on the close button; lists the same categories in the same order, "Log in", and EN/DE; press Tab 12 times → focus never leaves the drawer; press Escape → drawer closes, focus returns to the menu button; reopen, click a category → navigates and the drawer is closed; reopen, click the backdrop → closes; screenshot at each state (screenshots taken by Claude; owner may comment, D-068).
- C-I-9 (needs OA-02, G, H): at 767 px the drawer layout is active, at 768 px the desktop nav is shown and the menu button is hidden (`display: none`).
- C-I-10 (needs OA-02): `http://localhost:3000/en-US/this-page-does-not-exist` and `http://localhost:3000/de-DE/shop/a/b/c` → network shows document status **404**; page shows the full header and footer, the heading "We couldn't find that page" (de: "Diese Seite haben wir nicht gefunden"), a search field labelled "Search Malva", category links, and "Back to home"; type "cable" and submit → navigates to `/en-US/search?q=cable` (renders after P, otherwise 404 from P not yet built); at 375 px no horizontal scroll. Also `http://localhost:3000/nope` → redirected into a locale 404 page (D's redirect) or the bilingual root 404; never a blank page.
- C-I-11 (needs OA-02): `http://localhost:3000/en-US/dev/error` (development server; dismiss the Next dev overlay) → the server-error page: "Something went wrong on our side", "Try again" button, "Back to home" link, a "Reference:" line may be absent in dev; the text "boom-test" and any stack trace do not appear in the page body (outside the dev overlay); header and footer still render; "Try again" re-renders the same error (the route always throws); console shows the logged `[error-boundary]` entry only. Production behaviour: `npm run build && npm run start`, `/en-US/dev/error` → 404.
- C-I-12 (needs OA-02): `http://localhost:3000/en-US/unauthorized?ref=AB12-CD34` → heading "You don't have access to this", "Reference: AB12-CD34", buttons "Go to my account" and "Contact support"; `?ref=<script>` shows no reference line; response has `<meta name="robots" content="noindex">`.
- C-I-13 (needs OA-02, R, S): signed out, open `http://localhost:3000/en-US/account/orders` → redirected to `/en-US/login?next=%2Faccount%2Forders` (not to `/unauthorized`); after signing in the buyer lands on `/en-US/account/orders` (deferred until R and S are verified).
- C-I-14 (needs OA-02, R): signed in as the seeded demo customer → header reads "Hi, <first name>" linking to `/en-US/account`; sign out → "Log in". Open the same URL in a second incognito context: it shows "Log in" (no leakage between buyers); view-source of the page shows no first name for anonymous requests.
- C-I-15 (needs OA-02, G, H, M): add one plan and one add-on in the bundle → header pill reads "My bundle · 2" on every page, including `/en-US/dev/error` and a 404 page (error pages keep the buyer's session and bundle intact); with two plans and one add-on "My bundle · 3"; an equipment line does not change the number (deferred until M is verified).
- C-I-16 (needs OA-02, G, H): Lighthouse (desktop and mobile, navigation mode) on `/en-US` and on a 404 page → Accessibility score ≥ 95, no "contrast" audit failures, no "buttons without accessible name" or "links without discernible name" failures, Best practices ≥ 90.

## Manual tests (owner only)
None.

## Excluded
- "Unauthorized" with named permissions, associates, business-unit roles (B2B, D-005): no permission vocabulary exists; only a reference is shown.
- Support page content (built in W, D-034, D-051); search page (P); `/login` page (R).
- Real CDN-served 500 page (see Design §5, question 2).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test; the contrast test passes.
- [ ] C- lines present; screenshots taken by Claude (C- checks); owner may comment (D-068); STATUS set to `Ready for review`.
- [ ] The header, drawer and footer contain no hex, no `px` literal and no font names; no function props cross a server/client boundary.
- [ ] `AccountLink` is not cached and not imported anywhere with `unstable_cache`.
