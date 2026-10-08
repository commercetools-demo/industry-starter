# Malva Healthcare — design

Source: Claude Design project `f22d9608-5e56-499a-99b0-82b84cda2b28` on design system `8f4e291a-5553-4159-8816-b4c3f0f7742c` (Healthcare, extracted from the Figma Community file "Desktop Designs : Healthcare Consultation"). Raw files in `source/`. US English, USD.

The product is a telehealth-plus-pharmacy storefront: book a doctor (video or office), look up a prescription by RX number and have the medicine delivered, read lab results.

## Principles

1. **Azure carries action, navy carries ink.** Every button, link, active nav item and selected state is `brand-*` (base `#2aa7ff`). Headings, the footer and totals are `navy-700`/`navy-900`.
2. **Soft cards on sky.** Page heads sit on `--gradient-sky`; cards are white, `--radius-lg` (15px), `--shadow-sm`. Inputs are filled `neutral-25` with a 1px border, not outlined.
3. **8px controls, not pills.** Buttons, inputs, segmented controls: `--radius-md`; slots, small buttons, badges: `--radius-sm`.
4. **Poppins for UI, Lato for meta, Roboto for footer.** Headings/nav/buttons/names Poppins; experience, ratings, table headers, crumbs Lato.
5. **Green means available or free.** `success` marks "Available today", "FREE", "Normal"; amber marks "Processing"; `danger` marks out-of-range results. Not generic positive actions.
6. **Guests can book; patients sign in for everything with health data.** Doctor search, profile and booking need no account. Prescriptions, cart, checkout, orders, labs and account require sign-in.

## Tokens

Source of truth: `source/_ds/tokens.css` (84 custom properties). The storefront carries them verbatim, names included.

| Group | Tokens | Notes |
| --- | --- | --- |
| Brand (Azure) | `--color-brand-50…950`, base 500 `#2aa7ff` | 600 `#2593e0` = link/hover and small brand text; 700 = outline-button text, doctor names |
| Navy | `--color-navy-50…950` | 700 `#1b3c74` = headings, totals, footer, selected day; 900 `#102851` = nav text, overlay |
| Neutral | `--color-neutral-0, 25, 50…700, 900` | 25 = page background and input fill; 500 muted; 600 meta |
| Status | `--color-success/warning/danger/info-500` and `-50` | `-50` = badge background |
| Gradients | `--gradient-sky`, `--gradient-brand`, `--gradient-peach` | sky = page head/hero; brand = hero image, CTA band; peach = doctor avatar |
| Semantic | `--color-text`, `-heading`, `-body`, `-muted`, `-placeholder`, `-on-brand`, `-link`, `--color-surface*`, `--color-border`, `--color-action(-hover)` | Prefer semantic over scale in components |
| Type | `--font-display` Poppins 400–700, `--font-meta` Lato 400/700, `--font-body` Roboto 400/500; `--text-xs…4xl` 12,14,16,18,20,24,36,48 | |
| Spacing | `--space-1…8` = 4, 6, 8, 10, 16, 20, 24, 40 | prototype also uses 12, 14, 18, 22, 28, 32, 56, 72, 88 |
| Radius | `sm 4, md 8, lg 15, xl 20, 2xl 40, pill 100` | pill unused |
| Elevation | `--shadow-sm` cards, `--shadow-md` hover/search, `--shadow-lg` modal/toast | |
| Layout | `--container-width: 1440px` in tokens; **prototype uses a 1200px container with 32px side padding** | open decision D2 |

### Gaps and off-system values in the prototype (fix when porting)

- Raw `#fff` (buttons, cards, chips) → `--color-surface` / `--color-text-on-brand`.
- Status text colors `#067a05`, `#8a5d00`, `#0a6f8c`, `#b3402a` and error color `#b3402a` have no tokens (darker AA-safe variants of success/warning/info/danger). Propose `--color-success-700`, `-warning-700`, `-info-700`, `-danger-700` (D3).
- `rgba(16,40,81,.5)` modal overlay = navy-900 at 50%; `rgba(255,255,255,.95)` sticky nav.
- Raw `px` values everywhere (type 13/15/26/28/30/32, spacing 12/14/18/22…).
- **Contrast:** white on `brand-500` is ~2.6:1 (DS README caveat). Used on every primary button, active nav/side-nav item and active segmented control. Plan: `--color-action` stays `brand-500` for fills but labels on it must pass AA — either darken the fill to `brand-600` (still ~3.4:1, large text only) or use `navy-900` label text (D4).
- Disabled button is 45% opacity only; no focus ring anywhere (`outline:0` on inputs, nothing on buttons/links).

## Components

| Component | Where | Anatomy / states |
| --- | --- | --- |
| Top nav | all app pages | sticky 72px, white 95% + blur, bottom border; logo mark (28px azure square, "M") + "Malva"; links Remote sessions / Office visits / Prescriptions / Lab tests (active = brand-600 + 2px underline); "Cart" outline small button with navy count bubble; signed-in = 36px initials avatar, else "Sign in" |
| Marketing nav | home | as above, links Home / Remote / Office / Prescriptions / Lab tests / Health journal; "Sign in" outline + "Book a visit" |
| Page head | app pages | `--gradient-sky`, 40/32 padding, H1 `clamp(28,4vw,40)` navy-900, muted sub (max 620) |
| Segmented control | doctor list, doctor detail | white, 1px border, 4px inset; items Poppins 500 14; active = azure fill/white (list) or the same in the booking panel |
| Filter bar | doctor list | white card, overlaps page head by −24px; search (grow), specialty select, city select (office only), "Available today" checkbox |
| Doctor card (list) | doctor list | 3 columns: 56px peach avatar with initials · name (brand-700 h3), "Specialty · N yrs experience", "★ rating (N reviews)[ · clinic]" · right: availability badge, fee (navy, bold), "View profile" small button. Whole card clickable, hover = brand-300 border + shadow-md |
| Doctor card (home) | home | 72px avatar, same text, "Available today" badge, footer row "Video · $35" + "Book" |
| Availability badge | cards | `b-ok` "Available today"; `b-info` "Next: Tue 14" |
| Day picker | doctor detail | 7 columns, day abbreviation + date; selected = navy-700 fill |
| Slot grid | doctor detail | 3 columns, brand-300 outline, hover = azure fill; empty state note |
| Booking modal | doctor detail | overlay + 520px card; summary note, booking-as line, name/email (guests), phone, reason textarea, "Confirm booking" |
| Prescription lookup | prescriptions | RX number input + Search in the page head, quick-pick badges, result card (header with RX no./prescriber/date, patient + refills badges, select-all, medication rows, total + "Add to cart") |
| Medication row | rx, cart | checkbox · name (500) + sig (meta) · "Qty N" · price; cart row = name + RX/qty · price · "Remove" link |
| Summary card | cart, checkout | white card; subtotal, delivery (FREE badge or fee), total (navy 20px bold), full-width button; sticky at 96px on checkout |
| Radio card | checkout | 1.5px border, azure when selected; label left, price right |
| Order timeline | order | 4 steps, 12px dot, green when done |
| Account side nav | account | 240px; Overview / Lab tests / Appointments / Orders; active = azure fill; "Sign out" outline small |
| Stat tiles | account overview | auto-fit 180px; 32px navy number + label; clickable |
| List row | labs, orders, appointments | 3-col row; hover brand-50; status badge + "→" |
| Lab result table | lab detail | columns Test / Result+unit / reference-range bar + text / flag badge; marker position clamped 4–96%; out-of-range = danger-50 track; actions "Download PDF", "Discuss with a doctor" |
| Toast | rx | bottom-center navy-900, "Added to cart" + "View cart →", 5s |
| Badge | everywhere | Lato 700 12px, `--radius-sm`; ok / wait / info / no / neutral |
| Footer | app | navy-700 strip: © line + "Not for emergencies — call your local emergency number." |
| Footer (home) | home | navy-700, 4 columns (brand blurb, Care, Pharmacy, Company) + legal row |

## Pages and routes (prototype)

Hash routes in `Malva App.html`; home is a separate file.

| Route | Page | Access | Spec |
| --- | --- | --- | --- |
| `Malva Healthcare.html` | Home | public | `design-home-page` |
| `#/doctors/remote`, `#/doctors/office` | Doctor list (PLP) | public | `design-plp` |
| `#/prescriptions` | Prescription lookup | sign-in | `design-plp` |
| `#/doctor/:id?m=remote\|office` | Doctor profile + booking (PDP) | public | `design-pdp` |
| `#/booked/:id` | Booking confirmation | public (own booking) | `design-pdp` |
| `#/cart` | Cart | sign-in | `design-cart` |
| `#/checkout` | Checkout | sign-in | `design-checkout` |
| `#/order/:id` | Order confirmation / tracking | sign-in | `design-checkout` |
| `#/login` | Sign in / create account | public | `design-account-area` |
| `#/account`, `/labs`, `/labs/:id`, `/appointments`, `/orders` | Account area | sign-in | `design-account-area` |
| `#/labs` | alias → `/account/labs` | sign-in | `design-account-area` |
| anything else | redirect → `/doctors/remote` | — | — |
| Header/footer (all) | Shell and tokens | — | `design-system-tokens`, `design-storefront-shell` |

Not designed (links are `#` or absent): Health journal articles, Mental health, Second opinion, About, Careers, Contact, Delivery info, search results, order cancellation, address book, payment methods, registration confirmation, password reset, error pages, mobile menu (nav links are hidden under 900px with no replacement), empty/error states for the doctor profile slot fetch.

## Observed content and data

All prototype data is fixture data and must come from the platform.

- **8 doctors** across New York, Austin, Chicago; specialties General Practice, Dermatology, Psychiatry, Pediatrics, Cardiology, Orthopedics, Gynecology. Each: name, specialty, years, rating, review count, remote fee ($30–95), office fee ($50–140), clinic, city, languages, education, bio.
- **Slots:** fixed 10-time base list (09:00–17:30) filtered per doctor/day by a deterministic function; next 7 days; booked slots removed.
- **2 prescriptions** (`RX-48213`, `RX-77102`) with 3 and 2 medications, qty, sig, price, refills left. RX input normalises `rx 48213`/`RX48213` → `RX-48213`.
- **5 lab tests** (CBC, lipid, HbA1c, vitamin D, thyroid) with value, unit, reference range; status `ready`/`processing`.
- **Shipping:** Standard 1–2 days FREE; Same-day by 8 pm $5.00. Bookings: "pay at the visit".
- **Home stats** (2M+ consultations, 8,000 doctors, 15 min median wait, 4.8/5) and floating hero chips ("12 doctors available now", "Rx #4821 out for delivery · 25 min") are literals.
- **Copy conventions:** "Remote session" (toggle) vs "Remote sessions" (nav/page), "Video"/"In office" (booking toggle), "RX number", "Sign in" (not "Log in").

## Known prototype defects not to copy

- Interactive `div`/`a` without `href`/`role`/keyboard support (doctor cards, day cells, lab rows, "Remove", "Close", mode links); `outline:0` with no focus style.
- Client-side money arithmetic, fee/total computation, deterministic fake availability, fake auth ("any email and password will sign you in"), orders/bookings in `localStorage`, `Math.random` order/booking IDs.
- Card number, expiry, CVC rendered as plain inputs **with prefilled test card values**; real payment must use the payment widget, never raw card fields in the storefront.
- Guest booking collects "reason for visit" free text and phone with no consent or retention notice; confirmation page echoes the email.
- "Unknown RX" error echoes the user's input verbatim (HTML-escaped by React, but still a probing oracle with no rate limit).
- Cart item key = `rx + medId`; adding the same RX twice replaces rather than errors; no quantity control; no stale-price handling.
- Checkout validates nothing beyond `required`; ZIP/phone formats, address validation, delivery cut-off for same-day are absent; `Place order` is not disabled while submitting.
- Order detail looks up local orders only — no deep link for another device.
- Stat tiles, nav "Lab tests" and the "Discuss with a doctor" link target different routes without preserving context (the lab/doctor is not preselected).
- Nav logo links to the marketing file, so app→home is a full page load.
