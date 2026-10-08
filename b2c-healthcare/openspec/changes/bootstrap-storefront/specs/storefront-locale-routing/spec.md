<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Region configuration as one table

The system SHALL define every supported region once in `COUNTRY_CONFIG` (`lib/utils.ts`), keyed by BCP-47 locale (for example `en-US`), giving country, currency and language, and SHALL derive routing locales from it.

#### Scenario: Single source
- **GIVEN** the codebase
- **WHEN** locale, country or currency is needed
- **THEN** it is read from `COUNTRY_CONFIG`; no component hard-codes `USD`, `US` or `en-US`

#### Scenario: Region not configured in commercetools
- **GIVEN** a `COUNTRY_CONFIG` entry whose country, currency or language is not enabled in the commercetools project
- **WHEN** the supported-region list is computed
- **THEN** the entry is excluded (project settings fetched and cached for 300 s), so the visitor cannot select a region that cannot price or sell

### Requirement: Locale-prefixed routes

The system SHALL serve all pages under `/<locale>/…` with `localePrefix: 'always'` and redirect unprefixed paths to the visitor's locale.

#### Scenario: Unprefixed request
- **GIVEN** a request to `/doctors/remote`
- **WHEN** `proxy.ts` runs
- **THEN** it redirects to `/<locale>/doctors/remote`, using the `your-shop-country-locale` cookie when valid and `en-US` otherwise

#### Scenario: Excluded paths
- **GIVEN** a request under `/api`, `/_next`, or for a file with an extension
- **WHEN** `proxy.ts` runs
- **THEN** it is not redirected

#### Scenario: Unsupported locale in the URL
- **GIVEN** `/fr-FR/…` where `fr-FR` is not supported
- **WHEN** the route resolves
- **THEN** the visitor is redirected to the default locale equivalent (or sees the not-found page defined by `error-pages`), never a page with mixed languages

### Requirement: Locale-aware navigation only

The system SHALL import `Link`, `redirect`, `usePathname`, `useRouter` and `getPathname` from `@/i18n/routing` in locale UI.

#### Scenario: Bare Next link
- **GIVEN** a component importing `next/link` or navigation helpers from `next/navigation` (other than `notFound`)
- **WHEN** lint runs
- **THEN** it fails

### Requirement: Messages and document language

The system SHALL load message catalogs per locale through `i18n/request.ts` and set `<html lang>` from the active locale.

#### Scenario: Missing key
- **GIVEN** a translation key absent from the active catalog
- **WHEN** the page renders in development
- **THEN** the error is logged with the key; in production the default-locale text is shown rather than the key

### Requirement: Locale in the session is atomic

The system SHALL treat `locale`, `currency` and `country` as one unit: a change writes all three to the session together, and a change of currency resets `cartId`.

#### Scenario: Partial update rejected
- **GIVEN** a request that changes only one of the three
- **WHEN** the session is written
- **THEN** the request is rejected or completed from `COUNTRY_CONFIG`, never stored half-applied

#### Scenario: Handing off the cart conflict
- **GIVEN** a cart priced in the previous currency
- **WHEN** the region changes
- **THEN** how the cart is carried, converted or cleared and what the patient is told is governed by `switching-region-or-language`; this requirement only guarantees the session never disagrees with itself

## commercetools

Skill: `commercetools-storefront` (`core/add-country.md`). Reads Project (countries, currencies, languages). Region changes affect price selection and product availability; those rules live in `switching-region-or-language`.

## Open questions

- Which regions beyond `en-US` are launch scope (Q2 in `design.md`).
