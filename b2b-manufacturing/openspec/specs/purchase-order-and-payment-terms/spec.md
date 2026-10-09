<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Purchase order and payment terms

## Purpose

Most B2B orders are settled by invoice on account, not by card capture. The buyer's finance team reconciles against a purchase order raised in their own procurement system, so an order that cannot carry that reference is an order their finance team cannot pay.

## Requirements

### Requirement: Purchase order and payment terms

The storefront SHALL let a buyer place an order against their own purchase order reference and agreed payment terms, so the order can be reconciled and invoiced without a card being charged at checkout.

#### Scenario: Purchase order reference carried
- **GIVEN** a buyer with a purchase order number from their procurement system
- **WHEN** the buyer enters it during checkout
- **THEN** the reference is stored on the order and appears on the resulting invoice

#### Scenario: Settled on terms not by card
- **GIVEN** a company with agreed net terms
- **WHEN** the order is placed
- **THEN** no card is charged at checkout and the order is recorded as payable on those terms

#### Scenario: Net price quoted tax added
- **GIVEN** a B2B order in a net-priced project
- **WHEN** totals are shown
- **THEN** the net amount is the quoted basis and tax is shown added on top, not baked into the price

#### Scenario: Credit limit exceeded
- **GIVEN** a company at its credit limit
- **WHEN** an order would exceed it
- **THEN** the buyer is told before submission rather than having the order fail after placement

## Pages

- [Cart with engine-calculated totals after every change](../cart-page/spec.md)
- [Checkout re-reading totals after each shipping change](../checkout-page/spec.md)
- [Order confirmation stating reference and true order state](../order-confirmation-page/spec.md)
- [Saved payment methods and account payment terms](../payment-methods/spec.md)
- [Invoice history and outstanding balance on account](../invoice-and-billing-history/spec.md)
- [Cost center codes assignable to a purchase](../cost-center-management/spec.md)

## commercetools

**Entities:** `Cart`, `Order`, `Quote`, `Payment`, `TaxRate`, `TaxCategory`, `CustomObject`, `Type`

**Verified API surface**

- (concept) purchaseOrderNumber is a native field on Cart, Quote Request, Staged Quote, Quote and Order; a value set on the Cart is inherited by the Order or Quote Request created from it, so it is set once at the start of the flow — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (concept) Most B2B orders settle by invoice on account against agreed net terms; model the settlement with the Payments resource and treat card authorization at checkout as the exception rather than the default — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (concept) For B2B data with no native field, a Custom Field belongs on the resource it describes and a Custom Object suits standalone data referenced from elsewhere — a company's credit limit is the Custom Object case — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Constraints that change the design**

- Use the native purchaseOrderNumber rather than a Custom Field for the PO. Custom Fields remain correct for B2B context with no native field, such as a cost-center reference on a line item — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- includedInPrice false on the Tax Rate means the price is net and tax is added on top, which is the typical B2B configuration; the cart's taxedPrice then exposes both totalNet and totalGross — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)
- TaxCalculationMode LineItemLevel versus UnitPriceLevel changes when tax is applied relative to quantity; at B2B volumes the rounding difference accumulates across an invoice, and taxRoundingMode controls each step — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)
- Complex jurisdictions such as United States sales tax require an external tax provider through External or ExternalAmount tax mode; treating them as configuration inside commercetools is a documented and costly modeling mistake — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)

**Modeling notes**

Set purchaseOrderNumber on the cart at the start of the flow and let it propagate; retrofitting it onto the order loses the quote path. Credit limits and invoicing live downstream — commercetools records the order and the settlement intent, the finance system issues and reconciles the invoice. Fix TaxMode, TaxCalculationMode and taxRoundingMode as project decisions before building totals.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns credit limits and invoice generation, and how does the storefront read them?
- Is a purchase order number mandatory for every order, or per company?
