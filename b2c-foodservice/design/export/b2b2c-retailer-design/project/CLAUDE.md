# VELA Storefront — project notes

A high-fidelity, clickable storefront prototype for **VELA**, a fictional activewear
brand. Built as a commercetools composable-commerce demo (B2C + B2B in one storefront).

> B2B-specific behavior is documented separately in **`B2B-addons.md`** — read that
> file before touching anything gated behind the B2B tweak.

## What it is
- Single-page React prototype. Entry point: **`VELA Storefront.html`**.
- All app code is plain JSX transpiled in-browser by Babel (no build step). Each file
  is a `<script type="text/babel">` in the HTML; load order matters and is set there.
- Fictional brand. Nothing here is real commercetools product data — it's a demo.

## Design system
Bound to the **commercetools** design system (navy/indigo `#191741`, electric violet
`#6359FF`, teal `#0BBFBF`, warm off-white canvas). Brand name is always lowercase
`commercetools`. No emoji. The storefront uses its **own** local token layer in
`app/colors_and_type.css` + `app/styles.css` (e.g. `var(--ink)`, `var(--accent)`,
`var(--canvas-2)`, `var(--line-2)`, `var(--teal)`) — style against those, not raw
values. The oxlint "use a var(--ds-*) token" warnings are expected; this prototype
predates that contract and uses its own consistent token names.

## Backed by commercetools APIs
This is a mock, but every feature maps to a real commercetools capability. Docs:
**https://docs.commercetools.com/docs**. When implementing for real, wire these to the
corresponding APIs rather than the local demo state:

| In this prototype | commercetools concept / API |
|---|---|
| Cart + checkout | **Carts** (and **Me/Carts** for the signed-in buyer) |
| Place order | **Orders** (order created from a Cart) |
| Products, colorways, sizes, B2B variant table / SKUs | **Products** + **Product variants** |
| Prices, pack/volume pricing, `money()` | **Embedded/Standalone Prices**, price tiers; **Money** + currencies |
| "Create a quote" + negotiation thread | **Quote Requests → Staged Quotes → Quotes** |
| Purchase Lists (multiple, shared) | **Shopping Lists** (one per list) |
| PDP "Add to purchase list" (replaces the heart/favourite) | **Shopping Lists** (add line item) |
| Business Unit + Store selectors | **Business Units** + **Stores** / **Channels** |
| Member roles (buyer / approver / admin) | **Associate Roles** on a Business Unit |
| Approval flows + approve/reject | **Approval Rules** / **Approval Flows** |
| Addresses (shipping / billing) | Business Unit / Customer **addresses** |
| Look up product / quick order by SKU | **Product Projection search** by SKU |
| Sign-in, avatar, "Hi, Maya" | **Customers** + **Me** (associate) endpoints |

See `B2B-addons.md` for how each of these is realised in the prototype.

## File map (`app/`)
| File | Responsibility |
|---|---|
| `app.jsx` | Root `App`: routing, all global state, localStorage, mounts. Renders Tweaks panel. **Last script loaded.** |
| `data.jsx` | All data + helpers: products, colorways (`CW`), stores, currencies/`money()`, B2B account/members/orders/quotes/lists/addresses/flows. |
| `components.jsx` | Shared UI: `Icon` (inline Lucide-style set), `Header`, `ProductCard`, `CartDrawer`, `StorePicker`, account bar, user menu, `Footer`, `Toast`. |
| `garments.jsx` | SVG garment renderer (`<Garment type colorway bgTint>`) — stands in for product photography. |
| `nav-extras.jsx` | Mega menu, mobile nav, locale chooser. |
| `filters.jsx` | PLP faceted-filter logic + sidebar. |
| `pages-shop.jsx` | `HomePage`, `ListingPage` (PLP / search). |
| `pages-pdp.jsx` | `ProductDetail` (PDP). |
| `pages-checkout.jsx` | Cart, checkout (BOPIS pickup step), confirmation. |
| `pages-account.jsx` | Consumer dashboard (`AccountPage`); delegates to the B2B dashboard when B2B is on. |
| `pages-b2b.jsx` | B2B PLP variant table, SKU helpers, Look-up-product modal. |
| `pages-b2b-dashboard.jsx` | The whole role-aware B2B dashboard. |
| `tweaks-panel.jsx` | Tweaks shell + controls (starter component — don't rewrite). |

## Conventions
- **State lives in `App` (`app.jsx`)** and flows down via props. Persisted slices use
  `loadLS`/`saveLS` (localStorage keys are `vela_*`). Never clear localStorage keys you
  didn't write.
- **Cart:** `addToCart(product, opts)` where `opts` may set `color`, `size`,
  `qty`, `fulfillment` (`'pickup'|'ship'`), `price` (override for B2B pack pricing),
  and `toast:true` to show the "Added" toast. Cart line `key` = `id|color|size|fulfillment`.
- **Currency:** always render money via `money(n)` — it converts the USD base number by
  the active locale rate and prefixes the symbol. Don't hand-format prices.
- **Icons:** add new glyphs to the `ICONS` map in `components.jsx` (1.75 stroke,
  24×24 viewBox), then use `<Icon name="…" />`. No emoji.
- **Each Babel script has its own scope.** Share across files by assigning to `window`
  at the end (`Object.assign(window, {…})`); reference by bare global name elsewhere.
  Never name a styles object just `styles`.
- **Tweaks:** defaults live in the `TWEAK_DEFAULTS` block in `app.jsx`; the panel is
  rendered at the end of `App`. Read with `useTweaks`, write with `setTweak`.

## Verifying changes
Open `VELA Storefront.html`. Tweak state is owned by the host, so in the live view it
persists; an internal preview reload may appear to reset it — not a bug.
