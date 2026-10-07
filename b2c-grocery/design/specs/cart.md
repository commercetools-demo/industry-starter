# Cart ("Your bag") — design spec

Source: `MALVA Web.dc.html` (screen `cart`), header bag indicator (`chrome/bagIndicator`), toast.
Behavior: `openspec/specs/cart-page/spec.md`, `cart-management`, `out-of-stock-substitutions`.
Foundations: `../DESIGN.md`. Copy uses "bag" for cart.

## Layout
H1 52px "Your bag". 2-col grid `1.5fr / 1fr`, gap ≈42px.

### Lines (left)
Each line: 150×180 washed image (radius `md`) · content column:
- Row 1: H3 22px name (left) and line total 17px (right).
- Maker (card-meta).
- Lead-time tag (`tag-neutral`): "Made to order · 6–8 weeks" or "In stock".
- Bottom row: quantity stepper (min 1) · ghost *Remove*.
Lines separated by divider with 17.6px padding.

### Summary (right, sticky top 110px, `card elev-md`, padding 26px)
H3 24px "Summary" · Subtotal · "White-glove delivery" (€45, "Included" when subtotal > €800 in prototype) · divider · **Total** heading font 24px ·
*Checkout* (primary, block, 15px) · 13px muted note "Complimentary returns within 30 days. Made-to-order pieces ship in 6–8 weeks."

### Empty
"Your bag is empty." 17px muted + *Browse the shop* primary.

## Related surfaces
- **Header bag**: primary button "Bag" / "Bag · N" (N = distinct lines in prototype).
- **Toast** after add: fixed bottom-right, "Added to your bag" + *View bag*.
- **Saved** screen (`wish`): kicker "N pieces saved", H1 "Put aside", 4-col cards (image 270, name, maker, price, *Add to bag* + ghost *Remove*), empty state with *Browse the shop*. Covered here because it is the bag's sibling; behavior in `saved-lists`.

## Interactions
Stepper updates line total, subtotal, delivery threshold and total immediately; Remove deletes the line (offer undo toast); Checkout → checkout.
Quantity changes are optimistic with rollback on failure.

## States
Empty · Loading · Line unavailable/out of stock (inline notice on the line + substitution choice, blocks Checkout until resolved) ·
Price changed (inline notice) · Promo code applied (row between Subtotal and delivery — **not drawn**) · Error banner above lines.

## Responsive (proposed)
≥1200 as drawn · <1200 single column, summary below lines (not sticky) with a sticky bottom Checkout bar on <768; line image shrinks to 96×116.

## Gaps vs. design
Promo code, tax line, estimated delivery, free-delivery progress and cart-level substitutions have no drawn design. Delivery-slot selection (grocery) lives in checkout.

## Acceptance
1. Totals always equal the server cart; client math is display only.
2. Free-delivery threshold and amounts come from configuration, not the prototype constants.
3. Quantity controls reachable by keyboard with accessible names ("Increase quantity of Ossa ribbed vase").
