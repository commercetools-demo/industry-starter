## ADDED Requirements

### Requirement: Single country configuration

`lib/utils.ts` SHALL define `COUNTRY_CONFIG` keyed by BCP-47 locale (`en-US` with USD/US and `de-DE` with EUR/DE only), each entry with `locale`, `currency`, `country` and `label`, plus `DEFAULT_LOCALE`. No other file SHALL hard-code a currency, country or locale. The same BCP-47 key SHALL be used for URL segments, the locale cookie, commercetools calls and message files.

#### Scenario: Add a market
- **WHEN** a country is added
- **THEN** only `COUNTRY_CONFIG` and `messages/<locale>.json` change, and routing picks it up

### Requirement: Locale-prefixed routing

Routes SHALL always carry a locale prefix (`localePrefix: 'always'`) defined in `i18n/routing.ts` via `defineRouting` and `createNavigation`, with message catalogs loaded in `i18n/request.ts` and falling back to the default locale for unknown values.

#### Scenario: Unsupported locale
- **WHEN** a request uses `/xx-YY/...`
- **THEN** the default locale's messages are used and the path is redirected into a supported prefix

### Requirement: Locale proxy

`proxy.ts` SHALL skip `/api`, `/_next`, favicon and file requests, pass through already-prefixed paths while setting `x-next-intl-locale`, and otherwise redirect to `/<locale>/…` using the `your-shop-country-locale` cookie or the default.

#### Scenario: First visit
- **WHEN** a visitor opens `/` with no cookie
- **THEN** they are redirected to `/en-US`

#### Scenario: Returning visitor
- **WHEN** the cookie says `de-DE` and the visitor opens `/`
- **THEN** they are redirected to `/de-DE`

### Requirement: Atomic market switch

Changing country SHALL update `locale`, `currency` and `country` in the session together, update the locale cookie, and reset `cartId` when the currency changes. A locale/currency combination not valid for the commercetools project SHALL be excluded from the selectable markets.

#### Scenario: Switch to Germany
- **WHEN** a visitor switches from `en-US` to `de-DE`
- **THEN** all three session fields change together and the old cart is not reused across currencies

### Requirement: Locale-aware links and messages

All in-app links SHALL use the locale-aware `Link`; user-visible strings SHALL come from message catalogs; the `<html lang>` attribute SHALL match the active locale.

#### Scenario: Link preserves locale
- **WHEN** a visitor on `/de-DE/shop` clicks a nav link
- **THEN** the target keeps the `/de-DE` prefix
