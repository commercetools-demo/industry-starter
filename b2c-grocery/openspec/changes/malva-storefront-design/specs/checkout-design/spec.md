## ADDED Requirements

### Requirement: Hosted checkout handoff

Checkout SHALL be the commercetools Complete Checkout (`checkoutFlow`, Adyen test connector), which owns contact, shipping address confirmation, shipping method and payment. The app SHALL NOT render the single-page checkout form drawn in the MALVA prototype. The cart "Checkout" button SHALL be enabled only when the cart has a deliverable address, a selected delivery slot and no unavailable lines, then SHALL create a checkout session server-side and open the hosted flow in the inline container of a branded page (`data-ctc`), showing the MALVA header and footer around it.

#### Scenario: Ready cart
- **WHEN** the cart has an address, a slot and available lines and the shopper clicks "Checkout"
- **THEN** a checkout session is created server-side and the hosted checkout opens on `/[locale]/checkout`

#### Scenario: Missing slot
- **WHEN** no slot is selected
- **THEN** the button is disabled and the cart explains that a delivery slot is needed

#### Scenario: Guest
- **WHEN** an anonymous visitor checks out
- **THEN** the hosted flow collects their email and the order is created for the anonymous cart

### Requirement: Checkout page frame

`/[locale]/checkout` SHALL show a kicker "Checkout", the 52px heading "Checkout", a compact order summary (lines, subtotal, delivery with slot, total with provisional label when applicable) and the hosted checkout container, and SHALL redirect to the cart when the session has no cart.

#### Scenario: Empty session cart
- **WHEN** the checkout page is opened without a cart
- **THEN** the visitor is redirected to the cart

### Requirement: Checkout failure handling

If the checkout session cannot be created (slot filled, unavailable line, API error), the app SHALL return to the cart with a message naming the reason and SHALL NOT open the hosted flow.

#### Scenario: Slot filled
- **WHEN** the selected slot is no longer available at handoff
- **THEN** the cart shows "That delivery slot just filled" with new slots offered

### Requirement: Order confirmation

After the hosted flow completes, the app SHALL clear `cartId` from the session, invalidate cart state and redirect to `/[locale]/checkout/confirmation/[orderId]`, a server-rendered page that fetches the order by id and shows the check blob, "Order <number>", "Thank you, {first name}", delivery slot, provisional-total notice when applicable, and buttons "Track this order" and "Back to the shop".

#### Scenario: Track order
- **WHEN** a customer clicks "Track this order"
- **THEN** the order detail in the account opens (guests are shown the order number only)

#### Scenario: Unknown order id
- **WHEN** the order id does not belong to the session's customer or recent guest order
- **THEN** a not-found page is shown
