<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seeded imagery sourced from Pexels, deterministically and with credit

## Purpose

A telecom listing with grey placeholders is hard to judge, and hand-picking photos for dozens of categories and products does not survive a second developer or a fresh project. Pexels offers free photography through an API, which makes it possible to give every category and product an image automatically. Two things make that go wrong if left implicit: the API is rate limited and a naive seeder re-queries it on every run, and the service requires visible credit. The result also has to be stable, because a catalog whose pictures change on every seed is impossible to demo or screenshot.

## Requirements

### Requirement: Seeded imagery sourced from Pexels, deterministically and with credit

The system SHALL attach a Pexels photograph to every seeded category and product from a recorded selection, so that repeated seeding yields the same images, stays within the API's rate limits and carries the credit the service requires.

#### Scenario: First seed selects and records
- **GIVEN** a manifest entry with an image search term and no recorded selection
- **WHEN** the seeding command runs with a Pexels key
- **THEN** it queries Pexels once for that term, selects a photo by a fixed rule, and records the photo's id, image URLs, photographer name and photo page URL in a committed lock file

#### Scenario: Re-seed uses the lock file
- **GIVEN** a lock file with a selection for an entry
- **WHEN** the seeding command runs again, with or without a Pexels key
- **THEN** it attaches the recorded image without calling Pexels, so reruns cost no quota and produce identical images

#### Scenario: Photo replaced deliberately
- **GIVEN** a recorded selection that is wrong for its offer
- **WHEN** a developer changes the search term or removes the lock entry and reseeds
- **THEN** a new selection is made and recorded, and only that entry changes

#### Scenario: Rate limit approached
- **GIVEN** the response headers report few remaining requests in the current window
- **WHEN** the next lookup would exceed them
- **THEN** the seeder stops looking up new images, completes the run with what is recorded, reports the entries left without images, and does not retry in a loop

#### Scenario: No key and no lock entry
- **GIVEN** an entry with no recorded selection and no Pexels key in the environment
- **WHEN** the seeding command runs
- **THEN** the product is still seeded, without an image, and the report lists it as missing an image rather than failing the run

#### Scenario: Credit shown to the buyer
- **GIVEN** a storefront page that renders seeded Pexels images
- **WHEN** the footer renders
- **THEN** it contains a visible link to Pexels, and each image's alternative text or label names the photographer, so the terms of use are met without per-page effort

#### Scenario: Image URL not trusted blindly
- **GIVEN** an image URL from the lock file
- **WHEN** it is attached or rendered
- **THEN** its host is `images.pexels.com`, and any other host is rejected by the seeder and by the image configuration

## Components

| Component | Notes |
| --- | --- |
| `seed/data/media.lock.json` | Committed; keyed by manifest key; holds photo id, chosen URLs, photographer, photo page URL |
| Search term per manifest entry | Authored in the manifest; deliberately generic (`fibre cable router`, `family phone call`) |
| Selection rule | First result of a landscape-oriented search, `per_page` small; never "random" |
| Image sizes | A large landscape rendition for cards and banners; a smaller one for thumbnails; the original is not stored |
| Pexels client | Reads `PEXELS_API_KEY` from the seeding environment; sends it in the `Authorization` header |
| Footer credit | A link to Pexels in the layout footer, present whenever seeded imagery is in use |
| Image host allow-list | `images.pexels.com` and the commercetools image CDN in `next.config.ts` |

## commercetools

**Entities:** `ProductVariant` (images), `Category` (assets)

**Verified API surface**

- (external) Pexels `GET https://api.pexels.com/v1/search` takes the API key in the `Authorization` header, accepts `query`, `orientation`, `size`, `page` and `per_page` (maximum 80), and returns photos with `src` renditions such as `large2x`, `landscape`, `portrait` and `medium` — [docs](https://www.pexels.com/api/documentation/)
- (external) The default limits are 200 requests per hour and 20,000 per month, reported in `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` response headers; workarounds for rate limits are prohibited — [docs](https://www.pexels.com/api/documentation/)
- (external) Use requires a prominent link to Pexels and, where possible, credit to the photographer — [docs](https://www.pexels.com/api/documentation/)
- (rest) A variant's `images` are a list of URL, dimensions and optional label; a category's `assets` carry sources and names — [docs](https://docs.commercetools.com/api/projects/products)

**Constraints that change the design**

- Image URLs stored in commercetools point at Pexels rather than at a copy. If the photo is removed or its URL changes upstream, the storefront image breaks; that is acceptable for demonstration data and is why this is a seeding concern and not a content-management one.
- Whether stored Pexels URLs may be hotlinked from a production storefront, or must be copied to Malva's own storage first, is not settled by the API documentation read for this spec and must be confirmed against Pexels' terms before any non-demo use.
- Images are attached as variant `images` for products and as `assets` for categories; a product's first variant image is the card image, so ordering is part of the data.

**Modeling notes**

The lock file is what turns a rate-limited, non-deterministic search API into a deterministic build input. Quota is spent once per entry for the life of the project instead of once per run, and a fresh clone with no Pexels key still seeds completely.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- May the seeded Pexels URLs be hotlinked in a deployed demo, or must images be copied to Malva-owned storage?
- Should the lock file be committed (stable across clones, recommended here) or regenerated per environment?
- Should banners on the home page reuse category images or have their own search terms?
