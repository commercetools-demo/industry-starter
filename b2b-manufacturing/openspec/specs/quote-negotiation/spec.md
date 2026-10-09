<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Quote acceptance at the negotiated price

## Purpose

A negotiation is only worth having if the agreed amount survives the next price change, so the agreed amounts are snapshotted on the offer and the order is created from the offer rather than from a re-priced cart. That also makes the offer's state the gate on what the buyer may do: an offer that has been superseded, withdrawn or sent back for renegotiation is not something the buyer can still accept.

## Requirements

### Requirement: Quote acceptance at the negotiated price

The system SHALL place an order created from a quote at the prices negotiated on that quote, irrespective of the catalog prices in force at the moment the order is placed.

#### Scenario: Accept the current offer
- **GIVEN** a quote that is the seller's current pending offer
- **WHEN** the buyer accepts it
- **THEN** an order is created carrying the quote's negotiated line item prices and the quote is recorded as accepted

#### Scenario: Send it back for another round
- **GIVEN** a pending quote the buyer wants improved rather than refused
- **WHEN** they submit a renegotiation request with a comment
- **THEN** the offer leaves the actionable state, the comment is retained against that round, and the buyer is told a new offer is expected from the seller

#### Scenario: Act on a superseded offer
- **GIVEN** a quote that has been declined, withdrawn or replaced by a later offer
- **WHEN** the buyer tries to accept or renegotiate it
- **THEN** the action is refused and the current offer, or the absence of one, is shown instead

#### Scenario: Buyer without acceptance rights
- **GIVEN** a buyer whose role does not permit accepting quotes
- **WHEN** they open a pending quote
- **THEN** the acceptance action is not offered and a direct attempt is refused rather than partially applied

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Quote list | `[MIDDLEWARE]` | The account's quote records |
| Quote detail with line items and pricing | `[MIDDLEWARE]` | Quote document carrying the negotiated prices |
| Message thread with the sales rep | `[MIDDLEWARE]` | Messaging or CRM integration |
| Accept quote and continue to checkout | `[MIDDLEWARE]` | Converts the quote to a cart |
| Download quote PDF | `[MIDDLEWARE]` | Document generation service |

## commercetools

**Entities:** `Quote`, `QuoteRequest`, `StagedQuote`, `Cart`, `Order`, `BusinessUnit`, `AssociateRole`

**Verified API surface**

- (concept) A Quote is a binding offer with states Pending, Accepted, Declined, DeclinedForRenegotiation, RenegotiationAddressed and Withdrawn; only Pending is actionable, and creating an Order from a valid Pending Quote uses the Quote's negotiated prices, with quoteStateToAccepted true recording acceptance during order creation — [docs](https://docs.commercetools.com/api/projects/quotes)
- (update-action) requestQuoteRenegotiation with a buyerComment moves a Pending Quote to DeclinedForRenegotiation; the seller reopens the Staged Quote and issues a new Quote, which moves the original to RenegotiationAddressed. Only a Pending Quote can be renegotiated — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/quotes-price-locking-and-renegotiation)
- (rest) GET /{projectKey}/me/quotes lists the buyer's Quotes, and changeMyQuoteState plus requestQuoteRenegotiation are the only buyer-side actions on one; they require the AcceptMyQuotes, DeclineMyQuotes or RenegotiateMyQuotes Permission, and POST /me/orders/quotes requires CreateMyOrdersFromMyQuotes — [docs](https://docs.commercetools.com/api/projects/me-quotes)

**Constraints that change the design**

- The negotiation record is the series of Quotes, not a message store: each Quote carries the sellerComment that accompanied that offer and the buyerComment that prompted it, whereas the Staged Quote's own sellerComment is mutable and always shows only the seller's latest edit — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/quotes-price-locking-and-renegotiation)
- A Quote Request cannot be raised from a Cart with shippingMode Multiple, from an anonymous Cart, or from a Cart carrying Discount Codes, and the source Cart must have a shippingAddress - so multi-site negotiated delivery needs one request per destination — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/quote-requests-and-staged-quotes)

**Modeling notes**

Render the conversation as a projection over the quote series plus whatever the CRM holds; do not model it as free-form messages hanging off the current offer, because each round's comments belong to the offer they produced. Acceptance is not a cart operation either: the order is created from the quote, so the storefront must not rebuild a cart from the quote's line items and price it again.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Does the conversation with the sales rep live in the CRM, or is the round-by-round comment history on the quote series sufficient to render the thread?
- Who generates the quote PDF, and must it be re-issued per round so the document always matches the offer the buyer accepted?
