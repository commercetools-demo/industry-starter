<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Quote request and negotiation

## Purpose

A negotiation is worthless if the agreed price does not survive to the order. Large or non-standard B2B purchases are priced by a person, not a rule, and the buyer's whole reason for asking is that the number they were given is the number they will pay.

## Requirements

### Requirement: Quote request and negotiation

The storefront SHALL let a buyer request a formal quote for a basket, negotiate it with a seller, and convert an accepted quote into an order at the agreed prices even if the catalog has moved since.

#### Scenario: Quote requested from a basket
- **GIVEN** a buyer with a basket that needs pricing
- **WHEN** the buyer requests a quote
- **THEN** a quote request exists carrying the basket, the company context and the buyer's purchase order reference

#### Scenario: Agreed price survives a catalog rise
- **GIVEN** a pending quote at a negotiated price, and a catalog price that has since risen
- **WHEN** the buyer creates the order from that quote
- **THEN** the order is placed at the quote's price, not the new catalog price

#### Scenario: Renegotiation
- **GIVEN** a pending quote the buyer will not accept as offered
- **WHEN** the buyer requests renegotiation
- **THEN** the seller can issue a fresh quote and the original is recorded as superseded rather than lost

#### Scenario: Quote no longer valid
- **GIVEN** a quote past its validity
- **WHEN** the buyer attempts to accept it
- **THEN** acceptance is refused with the reason, and the buyer is offered a new request

## Pages

- [Product detail page showing the buyer's effective price](../product-detail-page/spec.md)
- [Quote acceptance at the negotiated price](../quote-negotiation/spec.md)

## commercetools

**Entities:** `QuoteRequest`, `StagedQuote`, `Quote`, `Cart`, `Order`, `BusinessUnit`, `Channel`

**Verified API surface**

- (concept) The lifecycle is Cart to Quote Request to Staged Quote to Quote to Order; the Quote is the binding offer — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-quote-lifecycle)
- (rest) Creating an Order from a valid Pending Quote uses the Quote's captured amounts rather than re-resolving live prices; setting quoteStateToAccepted true records acceptance during order creation. It requires a permission such as CreateMyOrdersFromMyQuotes — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/quotes-price-locking-and-renegotiation)
- (concept) purchaseOrderNumber exists on Cart, Quote Request, Staged Quote, Quote and Order, and propagates forward, so the buyer's procurement reference set once at the start survives the whole negotiation — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Constraints that change the design**

- Quote states are Pending, Accepted, Declined, DeclinedForRenegotiation, RenegotiationAddressed and Withdrawn; only a Pending quote can be renegotiated — [docs](https://docs.commercetools.com/api/projects/quotes)
- Renegotiation moves a Quote to DeclinedForRenegotiation, the seller issues a new Quote, and the original becomes RenegotiationAddressed — so each round keeps its own sellerComment and buyerComment as a durable history — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/quotes-price-locking-and-renegotiation)
- Quote Requests are supported from a cart with shippingMode Single, a shippingAddress and no Discount Codes — a multi-shipping or discount-coded cart is not a valid quote-request shape — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Modeling notes**

Keep the quote cart and the direct-order cart separate: the quote path requires a single-shipping, discount-code-free cart, so trying to quote a multi-site basket fails late. The price lock is the whole product here — never re-resolve prices when converting an accepted quote.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Who prices a quote — a sales rep in Merchant Center, or a CPQ system?
- What is a quote's validity period, and who sets it?
