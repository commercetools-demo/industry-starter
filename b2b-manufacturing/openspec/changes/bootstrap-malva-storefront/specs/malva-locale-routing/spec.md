<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Locale configuration

The system SHALL define supported locales in one `COUNTRY_CONFIG` in `lib/utils.ts`, keyed by BCP-47 locale, each entry giving `country`, `currency` and `locale`, with two launch entries, `en-US` (US, USD) and `de-DE` (DE, EUR), and `DEFAULT_LOCALE` pointing to `en-US`.

#### Scenario: Single source of truth
- **GIVEN** `COUNTRY_CONFIG`
- **WHEN** routing, session defaults and commercetools calls need a locale, country or currency
- **THEN** they all derive it from this object

#### Scenario: Validated against the project
- **GIVEN** a `COUNTRY_CONFIG` entry
- **WHEN** locale validation runs
- **THEN** the entry is served only if the commercetools project lists its country, currency and language, and the result is cached for 300 seconds

### Requirement: Locale-prefixed routes

The system SHALL serve every page under `/<locale>/...` using `next-intl@^4` (`defineRouting`, `localePrefix: 'always'`), with routes under `app/[locale]/`.

#### Scenario: Unprefixed request
- **GIVEN** a request to `/plumbing`
- **WHEN** the proxy runs
- **THEN** it redirects to `/en-US/plumbing`, using the `your-shop-country-locale` cookie when present and valid, otherwise the default

#### Scenario: Excluded paths
- **GIVEN** requests to `/api/...`, `/_next/...`, `/favicon...` or any path containing a file extension
- **WHEN** the proxy runs
- **THEN** they are not rewritten or redirected

#### Scenario: Unsupported locale
- **GIVEN** a request to `/fr-FR/plumbing`
- **WHEN** the proxy and the router run
- **THEN** the response is the not-found page, not a crash

### Requirement: Locale-aware navigation

The system SHALL use `Link`, `useRouter`, `redirect`, `usePathname` and `getPathname` from `@/i18n/routing` in all locale-prefixed UI.

#### Scenario: Bare Next imports
- **GIVEN** a locale-prefixed page or component
- **WHEN** it imports `Link` from `next/link` or `redirect` from `next/navigation`
- **THEN** lint fails

### Requirement: Messages and metadata language

The system SHALL load the message catalogue for the active locale (`messages/<locale>.json`) through `i18n/request.ts` and SHALL set `<html lang>` to it.

#### Scenario: Message lookup
- **GIVEN** a Server or Client Component
- **WHEN** it needs UI text
- **THEN** it reads it from the catalogue; a missing key fails the dev build rather than showing the key

### Requirement: Atomic locale write

The system SHALL update `locale`, `currency` and `country` together, and SHALL reset `cartId` when the currency changes.

#### Scenario: Partial update refused
- **GIVEN** a call that sets only one of the three fields
- **WHEN** the helper runs
- **THEN** it rejects the call

#### Scenario: Currency change
- **GIVEN** a session with a cart in USD
- **WHEN** the locale write sets a different currency
- **THEN** `cartId` is removed from the session

### Requirement: Region and language switch

The system SHALL offer a switch between `en-US` and `de-DE` in the top bar and footer, which navigates to the same page under the other locale and writes locale, currency and country atomically.

#### Scenario: Switch keeps the page
- **GIVEN** a visitor on `/en-US/plumbing/drain-cleaning-cctv-survey`
- **WHEN** they choose Deutsch
- **THEN** they land on the same service under `/de-DE/...` (slug unchanged), the cookie `your-shop-country-locale` is updated, and the page text and content are German

#### Scenario: Quote list on switch
- **GIVEN** a quote list (cart) in USD
- **WHEN** the visitor switches to `de-DE` (EUR)
- **THEN** the list is started again in EUR with the same services and frequencies re-added, and a notice says so; no price is ever displayed

## commercetools

Skill: `commercetools-storefront` (`core/add-country.md` for adding locales later). Resource: Project (countries, currencies, languages), read through `unstable_cache`.
