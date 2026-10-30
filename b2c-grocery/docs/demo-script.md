# MALVA Grocery — Demo Guide

A commercetools storefront for an online grocer selling in the US (`en-US`) and Germany (`de-DE`): weight-priced fresh produce, delivery slots, substitution choices, saved lists and repeat deliveries.

| | |
|---|---|
| **Open** | [grocery-b2c-industry-starter.netlify.app/en-US](https://grocery-b2c-industry-starter.netlify.app/en-US) |
| **Sign in** | None to type. Create an account at **Register** (`/en-US/account/register`) with any email and an 8+ character password; the account is verified immediately and no email is sent |

**Short on time? Go to B** — fresh goods priced per kilogram, with an order total marked provisional.

## A — Browse the shop

| Click this | What it shows |
|---|---|
| ▶ Open the [shop](https://grocery-b2c-industry-starter.netlify.app/en-US/shop) | Category tree and product tiles read from the commercetools catalog |
| Open any category, then use the search box in the header | Category listing and search results come from the same catalog; search has its own results page |
| Click the heart on a product tile | The product is saved to a list without leaving the grid. Signed out, you are asked to sign in first and returned to where you were |
| Switch language or region in the header | The same page opens in the other locale (`en-US` or `de-DE`), with that market's currency and content |

## B — Weight-priced fresh goods

| Click this | What it shows |
|---|---|
| ▶ Open the [shop](https://grocery-b2c-industry-starter.netlify.app/en-US/shop) and open any product sold by weight | The tile and the product page show a price per unit of measure next to the price of the sellable increment |
| Add it to the bag and open the bag | The line is marked as repeating or one-time, and the order total is marked **provisional**: the final amount depends on the weight picked |
| Add a product sold in fixed increments only | Only those increments can be chosen and the total for that line is exact |

> Reconciling the picked weight against the provisional total happens in the grocer's fulfilment system. It is not part of this demo.

## C — Substitution preference per line

| Click this | What it shows |
|---|---|
| ▶ Open the [shop](https://grocery-b2c-industry-starter.netlify.app/en-US/shop) and add a produce, dairy or bakery item to the bag | Chilled products and products in fresh produce, dairy and eggs, and bakery categories default to **allow similar**; everything else defaults to no substitution |
| Open the bag and change a line's substitution preference | The choice is stored on that line and carries onto the order |
| After placing an order, open it under **Orders** in the account | An order with a substitute proposed outside the price tolerance asks for your consent and does not change until you accept |

## D — Delivery slots

| Click this | What it shows |
|---|---|
| ▶ Add any product to the bag and open the [bag](https://grocery-b2c-industry-starter.netlify.app/en-US/cart) | Sign in or register first if asked |
| Start checkout and choose an address, then a delivery slot | Seven days are offered, each with six 2-hour windows starting at 08:00. A picked slot is held for 15 minutes |
| Return to the bag | The chosen slot is stored on the commercetools cart, so it is still there after a reload |

> Slot availability comes from a stub service that lives inside the storefront, not from a real capacity system. Slots carry no price; delivery cost is the commercetools shipping method.

## E — Account: addresses, saved lists, orders

| Click this | What it shows |
|---|---|
| ▶ [Register](https://grocery-b2c-industry-starter.netlify.app/en-US/account/register) a new account | The anonymous bag you built before registering is kept and moves to the new account |
| Open **Addresses** and add two addresses, then **Make default** on the second | The **Default** tag moves at once and the default is stored on the commercetools customer. An invalid postcode shows an inline error and saves nothing |
| Open **Saved lists** | Products you saved with the heart |
| Open **Orders** | A new account shows **No orders yet**; an account with orders shows a status tag per order and an order detail page. Another customer's order id shows "We could not find that order" |

## F — Repeat deliveries

| Click this | What it shows |
|---|---|
| ▶ Sign in, then open a milk product page | The page offers a repeat interval next to **One-time** |
| Choose **Every 2 weeks**, add to the bag, open the bag | The line carries **Repeats every 2 weeks**. Adding the same product as **One-time** creates a separate line without the tag |
| Open **Subscriptions** in the account | Your repeat orders are listed and managed here once an order with a repeating line has been placed |

## What's real

| Feature | Real, and where it stops |
|---|---|
| Catalog, categories, prices, search | Read from the commercetools project · product photos are placeholders |
| Cart, customers, addresses, saved lists, orders | commercetools Carts, Customers and Orders · accounts are auto-verified and no email is sent, including order confirmation |
| Weight pricing | Price per unit and provisional total are shown · picked-weight reconciliation is not built |
| Substitutions | Per-line preference is stored on the line item · the proposal and acceptance flow is driven from the order page |
| Delivery slots | Slot choice is stored on the cart · availability and holds are an in-memory stub that resets on a cold start |
| Repeat deliveries | Repeating lines create a commercetools Recurring Order from an order · "Skip next delivery" is not built |
| Checkout | Hosted commercetools Checkout opens with the address prefilled · paying with a card is not available until a payment integration is attached to the Checkout application |

**Not built:** payment methods page, profile and password-change page, attribute facets, real contact-form delivery, a content management system for the Journal.

## If something looks off

| Symptom | Cause |
|---|---|
| A picked delivery slot is no longer held after some time | The slot service keeps its state in memory; the slot on the cart remains and is held again when checkout starts |
| Hosted checkout lists more shipping methods than the bag showed | Hosted Checkout lists every applicable commercetools shipping method |

## How it's built

HOW-IT-WORKS-DOC-URL-TO-BE-ADDED
