## Context

Project `spec-test-b2c`, region `us-central1.gcp`; locales `en-US` (USD, US) and `de-DE` (EUR, DE). Existing behavioral specs for weight pricing, slots, substitutions and subscriptions already define scenarios and commercetools constraints; this change defines the storefront experience and the data they need. The Recurring Orders API is beta. Decisions are in `plan/DECISIONS.md`.

## Goals / Non-Goals

**Goals:**
- A data model junior developers can verify and seed without guessing.
- Experiences that reuse Organic components and the Server/SWR split from the bootstrap change.

**Non-Goals:**
- Real capacity, picking, fulfillment or email systems (stubbed or external).
- Payment methods page, profile page, attribute facets, CMS-driven journal.

## Decisions

- **Data first.** Workstream F (catalog data model) is verified through the commerce MCP before any page is built; gaps are seeded, never assumed. Findings are written to `plan/PROJECT-FINDINGS.md` (no secrets).
- **Weight = increments as variants** (D-030). Each increment is a variant with an `incrementValue` and `incrementUnit`; the unit price is computed for display as price ÷ increment, normalized to kg/l/each.
- **InventoryMode None + app-side availability** (D-031). Cart creation sets `inventoryMode: 'None'`; add-to-bag and quantity changes read `ProductVariantAvailability` and refuse when `availableQuantity` is insufficient.
- **Slots** (D-033/D-042): `SlotService` interface in `lib/slots/` with a JSON-backed implementation. Selection stored on the cart as custom fields; re-validated and held when the checkout session is created; confirmed on the confirmation page. Placement-time rejection is not possible with hosted Checkout.
- **Substitutions** (D-032): preference on LineItem custom field `substitutionPreference` (`allow-similar` | `none`). Proposals are Order Edits created outside the app and marked with Order Edit custom type `substitution-proposal`; the storefront lists unapplied, undeclined ones on order detail. Accept applies the edit with its version; Decline sets `status=declined` on the edit.
- **Subscriptions** (D-034): `recurrenceInfo { recurrencePolicy, priceSelectionMode: 'Dynamic' }` on line items; Recurring Orders managed through the Recurring Orders API. If hosted Checkout does not create Recurring Orders from such carts, work stops and the owner decides (risk R-1).
- **Auth** (D-038): registration creates the customer, then creates and confirms the email token server-side. Reset: create password token; dev-only stub renders the link; production shows the generic confirmation only.
- **Saved lists** (D-040): commercetools ShoppingList with key `wishlist-<customerId>`; anonymous visitors are sent to sign-in.

## Risks / Trade-offs

- [R-1: Hosted Checkout and recurring carts] → Verify in a spike (task in workstream U); if unsupported, drop recurrence selection from checkout and ask the owner.
- [R-2: No placement-time slot rejection] → D-042; hold at session creation with a short expiry; document.
- [R-3: Order Edits creation path unclear for testers] → `plan/recipes/` documents an API recipe; owner confirms in TODO item S-6.
- [R-4: Product data in project may not match the model] → F step 1 inspects and maps; adapt the model before coding pages.
- [R-5: Unsigned designs for undrawn pages] → Owner sign-off items in TODO before each page is considered done.

## Open Questions

- Does the existing project data use the attribute names below, or must the model adapt (answered by F step 1)?
- Delivery slot windows and charges for the stub (proposed: next 7 days, 2-hour windows 08:00–20:00, capacity 10, charge from the shipping method).
