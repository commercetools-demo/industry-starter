# Account area — design spec

Source: `MALVA Web.dc.html` (screen `account`; header account icon; footer "Help" column).
Behavior: `openspec/specs/account-dashboard`, `account-and-self-service`, `account-sign-in`, `account-registration-request`, `order-history`, `address-book`, `payment-methods`, `saved-lists`, `password-reset`, `email-verification`.
Foundations: `../DESIGN.md`.

## What is drawn: the dashboard
Kicker "Member since 2023", H1 52px = customer name. 2-col grid `1.6fr / 1fr`, gap ≈42px.

### Left — Orders
H3 24px "Orders" + `.table`: columns **Piece · Reference · Placed · Status** (status right-aligned). Reference and date at 60% opacity.
Status tags: *Delivered* `tag-neutral` · *In the workshop* `tag-accent` · *On its way* / *Packing* `tag-accent-2`.

### Right — two cards (`card elev-sm`, padding 17.6px)
1. **Default address**: kicker, 3-line address (15px/1.6), ghost *Edit*.
2. **Details**: kicker, list rows 15px with divider and trailing "→": *Addresses, Payment methods, Returns, Concierge, Trade programme*. Hover → accent text.

## Pages implied by the dashboard (not drawn — design with the same patterns)
| Page | Pattern to reuse |
| --- | --- |
| Order history / order detail | Full `.table` with pagination; detail = line list as in Cart + status timeline using tags; actions *Track*, *Return*, *Reorder* (`post-purchase-order-management`) |
| Address book | Cards like "Default address" in a 2-col grid; add/edit in a `.dialog` with `.field` inputs; default marked with `tag-accent-2` |
| Payment methods | Rows like checkout payment (brand · last4 · expiry) with ghost *Remove*; add via PSP-hosted field |
| Saved (wishlist) | Existing "Put aside" screen — see `cart.md` |
| Sign in / register / reset | Centred 440px `.dialog`-style card or full page: H2, `.field` + `.input`, primary block button, ghost links; messaging per `account-sign-in`, `password-reset`, `email-verification` |
| Returns, Concierge, Trade programme | Content pages inside the same shell; Trade ↔ `account-registration-request` (business accounts) |

## Navigation
Header user icon → dashboard (or sign-in when anonymous). "Track this order" from confirmation → Orders. Sub-navigation: use the Details card as the rail on sub-pages (active row accent), collapsing to a select on small screens.

## States
Anonymous → redirect to sign-in with return URL · New customer (no orders): empty table state "No orders yet" + *Browse the shop* · Loading: skeleton rows ·
Email unverified: `tag-accent` banner with resend · Order status unknown: neutral tag.

## Responsive (proposed)
≥1200 as drawn · <1200 single column: cards first, orders table becomes stacked order cards (piece, ref, date, status) · <768 sub-nav as top select.

## Gaps vs. design
Only the dashboard is designed. All sub-pages above are proposals derived from existing components and must be reviewed with design before build.
Demo data (Camille Roux, orders MLV-22xx) is placeholder.

## Acceptance
1. Nothing account-specific is cacheable or visible to other sessions.
2. Status tag mapping is data-driven from order/delivery state; unknown states fall back to neutral.
3. Tables remain readable at 320px (stacked layout) and are navigable by keyboard/screen reader.
