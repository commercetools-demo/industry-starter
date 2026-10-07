# Checkout & confirmation — design spec

Source: `MALVA Web.dc.html` (screens `checkout`, `done`).
Behavior: `openspec/specs/checkout-page/spec.md`, `checkout`, `payment-methods`, `delivery-slot-booking`, `order-confirmation-page`.
Foundations: `../DESIGN.md`.

## Checkout layout
Kicker (`accent-700`) "Step 2 of 3 · Delivery", H1 52px "Checkout". 2-col grid `1.4fr / 1fr`, gap ≈42px. Single page, sections stacked with 26px gap, H3 22px headings.

| Section | Fields / controls |
| --- | --- |
| **Contact** | First name, Last name (2-col), Email (full width). Prefilled for signed-in users |
| **Shipping address** | Street (full), City, Postcode (2-col). Saved-address picker for signed-in users (see `address-book`) — not drawn |
| **Delivery** | Radio cards (radius `lg×1.15`, padding 13/17px): dot · name 15px/500 + note 13px muted · price. Selected = accent border + `accent-100` fill. Options: *White-glove* (€45 or Included, "Delivered, unpacked and placed"), *Standard courier* (€12, 3–5 working days), *Collect in Paris* (Free, showroom) |
| **Payment** | Bordered row: "Visa ···· 4417" + ghost *Change*. Real PSP form/Checkout widget replaces this (see `payment-methods`) |

### Order summary (right, sticky, `card elev-md`)
H3 24px "N pieces" · line rows (52×62 thumb, name × qty, line total) · divider · Subtotal · Delivery · **Total** heading 24px · *Place order* (primary, block).

## Steps
Header says "Step 2 of 3" — implied steps: 1 Bag → 2 Delivery (this page, includes contact/address/payment) → 3 Confirmation. The drawn page is a single form; a stepper component is **not drawn**.

## Confirmation (`done`)
Centred column max 640px, `orgUp` animation: 96px sage blob with check icon · kicker "Order MLV-2261" · H1 52px "Thank you, {first name}" · 17px copy (what happens next, stylist on hand) · buttons *Track this order* (primary → account orders) and *Back to the shop* (secondary → home).

## Interactions
Delivery selection updates summary delivery line and total immediately · *Place order* is disabled with spinner while submitting, double-submit safe ·
Success → confirmation with the real order number · Guest vs signed-in: guest sees account-creation prompt after confirmation (see `authentication-and-identity`).

## States
Validation: inline error under field, message 12px in `accent-700`, border accent · Payment failure: banner above Payment, order not placed ·
Address not deliverable: delivery options filtered, notice shown · Empty bag: redirect to cart · Session expiry: preserve entered data and prompt sign-in.

## Responsive (proposed)
≥1200 as drawn · <1200 single column; summary collapses into an expandable "Order summary · €Total" bar at top; place-order button fixed at bottom on <768.

## Gaps vs. design
Billing address, promo/gift codes, tax breakdown, terms checkbox, error states and the payment form itself are not drawn.
Grocery needs delivery-slot calendar (`delivery-slot-booking`) in place of/alongside the three delivery methods.

## Acceptance
1. Totals shown equal the server-calculated cart at submit time.
2. Prefilled demo values (Camille Roux, Visa 4417, order MLV-2261) are never shipped.
3. Every field has a visible label, autocomplete attributes, and an error message tied by `aria-describedby`.
4. Confirmation is reachable only for the order just placed.
