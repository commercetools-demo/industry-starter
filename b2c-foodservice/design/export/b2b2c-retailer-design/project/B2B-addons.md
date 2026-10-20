# VELA — B2B add-ons

Everything below is gated behind the **`b2b` tweak** (off by default). When off, VELA is
a normal B2C storefront; nothing here renders. Read `CLAUDE.md` first for the generic
architecture.

## Tweaks that drive B2B
Defined in `TWEAK_DEFAULTS` in `app.jsx`, shown in the Tweaks panel:
- **`b2b`** (bool) — master switch for B2B mode.
- **`b2bVolume`** (bool, shown only when `b2b`) — apply pack-size volume discounts.
- **`b2bRole`** (`'buyer' | 'approver' | 'admin'`, shown only when `b2b`) — drives the
  dashboard. The role radio appears under the B2B toggle.

## B2B account model (data in `data.jsx`)
- A buyer belongs to one or more **Business Units** (`B2B_ACCOUNT`); each unit has one or
  more **Stores** (channels). Header account bar renders these as dropdowns (static text
  if only one). Selected unit/store persist (`vela_bu`, `vela_bstore`); changing unit
  resets the store to that unit's first.
- **`B2B_MEMBERS`** — people in the unit, each with a `role`. The signed-in user is
  `USER` (Maya Okonkwo); avatar initials = first+last initial.
- Demo datasets: `B2B_ORDERS` (with `approval: none|pending|approved|rejected`),
  `B2B_QUOTES` (each has a nested `thread` discussion tree), `B2B_LISTS` (purchase lists),
  `B2B_ADDRESSES` (shipping + billing), `B2B_FLOWS` (approval-flow rules).

## Storefront chrome changes (`components.jsx`)
When `b2b`:
- **Account bar** above the header: Business Unit + Store selectors (`B2BAccountBar` /
  `BarSelect`). Replaces the promo top strip.
- **"Look up product"** header action (replaces the store-pickup pill) → opens
  `LookupModal` (in `pages-b2b.jsx`): look up by item number or upload CSV
  (`item number, quantity`), stages matched lines, "Add N items to cart".
- The header **user icon becomes an avatar** with initials + a dropdown (name, email,
  Dashboard, Sign out). This avatar/menu (`UserMenu`) shows in B2C too when signed in;
  sign out reverts to the plain icon and signs back in on click.

## Product listing (PLP) — `pages-b2b.jsx`
When `b2b`, `ListingPage` renders `B2BList` instead of the product-card grid: each product
expands into a **variant table** (one row per colorway) with item number (SKU), colour,
pack size, ex-VAT unit price, quantity stepper, and per-row Add-to-cart. A **pack-size
selector** (1 / 6 / 24) sits on each product; larger packs carry volume discounts when
`b2bVolume` is on.
- SKU format: `VELA-<prodAbbr>-<colorAbbr>-<packCode>` via `skuFor()`. `resolveSku()`
  reverses it (used by the look-up modal). `packPrice(unit, packSize, applyVolume)`
  computes pack price. `B2B_PACKS` defines the three pack tiers + discounts.

## PDP & checkout
When `b2b`:
- PDP: **"Add to purchase list"** button below Add-to-bag → `AddToListMenu` popover (pick a
  pack size, add to an existing list, or create one inline). The save/favourite **heart is
  hidden** (purchase lists replace it).
- Checkout (payment step): a **"Create a quote"** button sits beside Place order →
  `createQuote()` (see below).

## Role-aware dashboard — `pages-b2b-dashboard.jsx`
`AccountPage` early-returns `<B2BDashboard>` when `b2b`. The consumer **Pickup** and
**Saved** tabs are gone. Tabs by role (`tabsFor`):
- **Buyer:** Orders · Quotes · Purchase Lists · Addresses · Security
- **Approver:** + **Approvals**
- **Admin:** + **Approval Flows** · **Business Unit**

Views:
- **Orders** (`B2BOrders`) — read-only, whole business unit, shows approval state +
  which colleague placed each order.
- **Approvals** (`B2BApprovals`, approver) — status filter (awaiting/approved/rejected/
  all); approve or reject each pending order **with a comment**. Decisions held in local
  state.
- **Quotes** (`B2BQuotes`) — BU-wide list; opening one shows the item summary + an
  **iMessage-style negotiation chat** (`QuoteChat`; tree flattened via `flattenThread`,
  new messages appended with `addReply` to the last node). Buyer = violet right-aligned
  bubbles, trade desk = grey left-aligned; price proposals render inside bubbles. The
  composer is hidden once the quote is `Accepted`.
- **Purchase Lists** (`B2BLists`) — shared lists with shared-with avatars; change qty,
  remove, add a line to cart, or "Add all to cart". "New list" adds an empty list.
- **Addresses** (`B2BAddresses`) — shipping + billing sections; add/edit/delete/
  set-default per kind (`AddressCard`).
- **Security** (`B2BSecurity`) — change-password form with validation.
- **Approval Flows** (`B2BFlows`, admin) — threshold rules (order total > €X → approval
  by role); create / pause / delete.
- **Business Unit** (`B2BUnit`, admin) — edit unit name/code + stores; member table with
  editable role dropdowns; invite / remove members.

## Shared purchase-list & quote state (important)
Purchase lists and quotes are **lifted into `App`** so multiple surfaces share one source:
- **Lists** (`b2bLists`, persisted `vela_b2blists`): `addToB2BList(listId, item)` (merges by
  `productId+color+pack`, else appends) and `createB2BList(name, item)`.
  Item shape: `{ productId, color: <colorway name>, pack: <pack size>, qty }`; resolve with
  `listItemInfo()`.
- **Quotes** (`b2bQuotes`, persisted `vela_b2bquotes`): `createQuote()` (in `App`) turns the
  current cart into a quote (status `Requested`, seeded with one buyer thread message),
  clears the cart, sets `focusQuote`, and routes to the dashboard. `focusQuote` makes the
  dashboard open on the Quotes tab with that quote expanded; `go()` clears it on any other
  navigation. `B2BQuotes` reads `quotes`/`setQuotes` from props and edits threads in place.

When adding list/quote UI anywhere, go through these App-level mutators — don't keep a
second local copy.
