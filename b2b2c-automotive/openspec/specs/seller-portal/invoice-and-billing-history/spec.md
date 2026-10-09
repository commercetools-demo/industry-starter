<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Invoice history and outstanding balance on account

## Purpose

Net-terms buyers pay against invoices, not orders, and the platform has no invoice resource: the finance system issues the invoice and reconciles the payment. An order-derived balance therefore omits credit notes, partial payments and consolidated billing, and a buyer who pays from that figure underpays or overpays. The page's whole value is that its numbers are the seller's numbers.

## Requirements

### Requirement: Invoice history and outstanding balance on account

The system SHALL present every invoice raised against the buyer's account with its due date, outstanding amount and settlement status as held by the finance system of record, so the balance shown to the buyer reconciles with the seller's ledger.

#### Scenario: Balance matches ledger
- **GIVEN** an account with several open invoices and one credit note
- **WHEN** the buyer opens the billing history
- **THEN** the outstanding balance equals the finance system's figure for that account, and each invoice shows the order and purchase order number it bills

#### Scenario: Overdue invoice distinguished
- **GIVEN** an invoice whose due date has passed and is unpaid
- **WHEN** the list is rendered
- **THEN** that invoice is marked overdue with the number of days, distinctly from invoices that are merely unpaid and still within terms

#### Scenario: Pay now settles on confirmation
- **GIVEN** an open invoice with a pay-now action available
- **WHEN** the buyer completes payment at the gateway
- **THEN** the invoice moves to paid only once the finance system confirms settlement, and until then it is shown as payment in progress

#### Scenario: Finance system unreachable
- **GIVEN** the finance system cannot be reached
- **WHEN** the buyer opens the page
- **THEN** the last known balance is shown with the time it was read, the failure is stated, and the pay-now action is unavailable rather than posted blind

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Invoice list | `[MIDDLEWARE]` | Finance / ERP integration |
| Outstanding balance summary | `[MIDDLEWARE]` | Finance / ERP integration |
| Invoice detail — line items, due date, status | `[MIDDLEWARE]` | Invoice document |
| Download invoice PDF | `[MIDDLEWARE]` | Document service |
| Pay now CTA | `[MIDDLEWARE]` | Payment gateway integration |

## commercetools

**Entities:** `Order`, `Payment`, `Transaction`, `BusinessUnit`, `Customer`, `TaxRate`, `Type`

**Verified API surface**

- (concept) Order paymentState is an enum of exactly BalanceDue, Failed, Pending, CreditOwed and Paid, set with the changePaymentState update action - a per-order flag, not an aging balance, so it cannot carry due dates or partial settlement
 — [docs](https://docs.commercetools.com/api/projects/orders)
- (concept) purchaseOrderNumber is a native field on Cart, Quote Request, Staged Quote, Quote and Order and is inherited from the cart onto what is created from it, which makes it the join key between an invoice and the order it bills; use it rather than a Custom Field
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (concept) A Payment holds the PSP reference, the payment method and the connected transactions, and an Order or Cart references payments through PaymentInfo; a pay-now flow records a transaction in Pending and moves it to Success or Failure on the PSP's webhook or return
 — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/payment)

**Constraints that change the design**

- commercetools has no invoice resource. Most B2B orders settle by invoice on account against agreed net terms, with a downstream financial system issuing the invoice and reconciling payment; model the settlement with the Payments resource and treat card capture at checkout as the B2B exception
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- B2B is billed net: with TaxRate includedInPrice false the quoted figure is the net basis and tax is added on top, and the taxedPrice exposes totalNet and totalGross - the payable total on an invoice is the gross one
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)

**Modeling notes**

The finance system is the system of record for the invoice, its due date and the balance; the storefront is a read surface over it plus a payment initiation path. Keep the order's paymentState as a mirror of that state for order-level display, never as its source, and update it from finance events rather than from the storefront. Because invoices frequently consolidate or split orders, do not assume a one-to-one mapping between an order and an invoice - reconcile on purchaseOrderNumber and the invoice's own order references. Budget for the finance call being slow and cache the balance with an explicit read time.

## commercetools skills

Load `commercetools-connect` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-checkout`. Any task generated from this spec carries `[SKILL: commercetools-connect]`.

## Open questions

- Which system is the invoice master, and can it be queried inside the page's latency budget, or does the storefront need a synchronised projection?
- Does pay-now settle one invoice, a selection, or a statement balance - and who reconciles a partial payment or an unallocated receipt?
- Is the credit line and its remaining headroom exposed to the buyer, and does exceeding it block new orders, new invoices, or neither?
- Does an invoice ever cover several orders or part of one, and if so what does the buyer see against each order?
