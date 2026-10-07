# My bundle (cart)

Source: `isCart`. Title strip: "Home / My bundle", H1 "My bundle".

## States
- **Empty** — bordered card, centred: "Your bundle is empty" (Exo 700 26), "Choose a plan from any category, then add extras.", three pink pill CTAs: Phone plans / Wireless internet / Cable internet.
- **Full** — two columns: content (flex) + 320px sticky summary (`top:96px`), gap 32.
- **Ordered** — `pink-50` banner above content: "Order placed. A confirmation is on its way to {email}." (prototype clears the bundle and stays on the cart view).

## Plans (H2 "Plans")
Per selected plan (max one per category): card radius 24; honey header with kind (Exo 600 12), name (Exo 700 26), price (Exo 700 30 + "/mo"); body = left column (▸ bullets, hairline + validity, "Remove plan" text link) and right the **Broadband Facts label** for that plan.

## Add-ons (H2 "Add-ons")
Empty: "No add-ons yet. Browse add-ons". Row card: 48px `pink-900` initial tile, name (Exo 700 18) + description (muted 14), price (Exo 700 18), "Remove".

## Order summary
"Order summary" (Exo 700 22): Plans, Add-ons, divider, **Monthly** (Exo 700 22), One-time fees (muted 14; $25 activation per cable plan in the prototype), CTA ("Place order" signed in / "Log in to check out" anonymous → login then back to cart), note "Taxes calculated at checkout. Each plan's Broadband Facts label is shown on the left."

Note: the prototype's note says "on the left" but the label is rendered inside each plan card; reword when built. Totals/one-time fees/taxes come from the commercetools cart, not client arithmetic.
