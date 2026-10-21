<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product reviews and ratings on the commercetools Reviews API

## Purpose

Ratings sit on every product card, in the filter sidebar, in sort order and on the detail page, and shoppers can write reviews. All of it comes from the commercetools Reviews API and the rating statistics it keeps on each product, not from a separate system, so the numbers a shopper sees are the numbers in the Merchant Center. The seed creates reviews so the feature is demonstrable from day one.

Docs: https://docs.commercetools.com/guides/review-ratings

## Requirements

### Requirement: Ratings come from product statistics

The system SHALL read a product's average rating, review count and distribution from `reviewRatingStatistics` (`averageRating`, `count`, `ratingsDistribution`) on the product, map them in the product mapper, and show them on cards, the listing rating filter and the detail page. Average is rounded to one decimal for display only.

#### Scenario: Card rating
- **GIVEN** a product with 12 reviews averaging 4.58333
- **WHEN** its card renders
- **THEN** it shows 4.6 and 12 reviews

#### Scenario: No reviews
- **GIVEN** a product with no reviews
- **WHEN** its card renders
- **THEN** no star row is shown and the detail page offers "Be the first to review"

### Requirement: Listing by rating

The system SHALL support the "Top rated" sort and the "4.5 and up" and "4.0 and up" filters of `design-product-listing-page`. The documentation indicates Product Search can filter, facet and sort on `reviewRatingStatistics.averageRating`; workstream G confirms it against the live project. Only if that check fails does G record the finding and implement the fallback: an indexed number attribute written by the seed and a review hook, and sort by that attribute.

#### Scenario: Filter
- **GIVEN** the "4.5 and up" filter
- **WHEN** it is applied
- **THEN** only products with an average rating of at least 4.5 remain and counts follow the faceted rule

### Requirement: Review list on the detail page

The system SHALL list the reviews of the product through `GET reviews` with `where=target(typeId="product" and id="<id>") and includedInStatistics=true` and a sort chosen by the shopper (Newest, Highest, Lowest), 5 per page with "Show more", showing rating stars, title, text, author name, date and a "Verified purchase" mark when the review is linked to an order the customer placed. A distribution bar chart (5 to 1 stars) sits above the list.

#### Scenario: Sorted
- **GIVEN** a product with reviews of 5, 3 and 1 stars
- **WHEN** "Lowest" is chosen
- **THEN** the 1-star review is first

#### Scenario: Immediate visibility
- **GIVEN** a review was just created by another shopper
- **WHEN** the list loads
- **THEN** it is shown, because every review is published on creation

### Requirement: Write a review

The system SHALL let a signed-in customer write one review per product with a rating from 1 to 5 (required), a title (up to 80 characters) and text (up to 2000 characters), through `POST reviews` with the product as `target`, the customer reference, `authorName` from the profile (first name and last initial), and the market locale. Guests are asked to sign in and return to the form.

#### Scenario: Valid review
- **GIVEN** a signed-in customer who has not reviewed the product
- **WHEN** they submit rating 4 with text
- **THEN** a review is created for that product and customer and a confirmation is shown and the review is live

#### Scenario: Duplicate
- **GIVEN** the customer already reviewed the product
- **WHEN** they open the form
- **THEN** it offers to edit their review instead of creating another

#### Scenario: Missing rating
- **GIVEN** a form without a rating
- **WHEN** it is submitted
- **THEN** the rating control shows an error and nothing is sent

### Requirement: Published on creation

The system SHALL publish every review immediately and include it in statistics at once (D-037): there is no moderation, no pending state and no review states. A review is created with `includedInStatistics` true by default, and the product rating, count and distribution change as soon as it is saved.

#### Scenario: New review is live
- **GIVEN** a customer submits a review with rating 5
- **WHEN** it is saved
- **THEN** it appears in the product's list at once, the product statistics include it, and the customer sees "Thanks, your review is live"

### Requirement: Own reviews in the account

The system SHALL show the customer's own reviews, under Orders or a Reviews tab of the account, with edit and delete (`setRating`, `setTitle`, `setText`, delete by version).

#### Scenario: Edit
- **GIVEN** a published review
- **WHEN** the customer edits the text
- **THEN** it is updated and stays published, and the statistics follow the new rating

### Requirement: Seeded reviews

The system SHALL seed between 3 and 12 reviews per top product (none for a few, so the empty state is testable) written by the demo customers in en-US and en-CA, with a spread of ratings, all keyed `mcf-review-<sku>-<n>`, and `verify` SHALL compare product statistics with the seeded reviews.

#### Scenario: Statistics match
- **GIVEN** the seed finished
- **WHEN** `verify` runs
- **THEN** each product's `reviewRatingStatistics.count` equals its seeded review count

### Requirement: Safety

The system SHALL escape review text on render, limit length on the server, rate-limit review creation per customer, and never show a customer's email.

#### Scenario: Markup in text
- **GIVEN** a review containing `<script>`
- **WHEN** it renders
- **THEN** it appears as plain text
