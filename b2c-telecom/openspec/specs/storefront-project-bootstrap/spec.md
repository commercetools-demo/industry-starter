<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Reproducible Malva Telecom storefront bootstrap on current Next.js

## Purpose

Malva Telecom sells cable internet, home wireless internet, phone plans and add-ons such as Spotify and Apple TV. Before any of those pages exist, the project needs a foundation that every later change can assume: one framework version, one styling approach, one way to run it, and one rule for where secrets live. A bootstrap done by hand drifts: a Next.js line with known security fixes missing, a styling setup that differs between two laptops, a commercetools secret that ends up in the browser bundle because a variable was named with the public prefix. Fixing any of these after pages are built means touching every page, so the bootstrap is specified once and verified mechanically.

## Plan notes

**Reduced by D-003.** "CI" language becomes the local `npm run verify` (and `verify:release`); there is no CI. The deploy part (Netlify) is workstream Y: Package directory `b2c-telecom` is untested on real Netlify and the build needs `CTP_CHECKOUT_APP_KEY` (Q-025).

## Requirements

### Requirement: Reproducible Malva Telecom storefront bootstrap on current Next.js

The system SHALL provide a storefront application under `site/` that installs and starts from a clean clone using only documented commands, is built on the current stable Next.js 16 line with the App Router, and fails fast and visibly when its prerequisites are missing or out of version range.

#### Scenario: Clean clone to running storefront
- **GIVEN** a clean checkout, Node 22 and a populated `.env.local` copied from `.env.example`
- **WHEN** the documented install and dev commands are run in `site/`
- **THEN** the dev server starts and `/` redirects to the default locale-prefixed home route, which renders without errors

#### Scenario: Framework version below the gate
- **GIVEN** a dependency change that resolves `next` below the 16 line or `next-intl` below 4
- **WHEN** the verification step runs in CI or locally
- **THEN** it fails and names the package, the resolved version and the required range

#### Scenario: Required environment variable missing
- **GIVEN** a start or build without one of the required commercetools or session variables
- **WHEN** the application boots
- **THEN** it stops and names the missing variable, without printing the value of any variable that is present

#### Scenario: Session secret too weak
- **GIVEN** a session signing secret shorter than 32 characters
- **WHEN** the application boots
- **THEN** it refuses to start rather than signing sessions with it

#### Scenario: Secret never reaches the browser
- **GIVEN** a production build
- **WHEN** the client bundle and the public environment are inspected
- **THEN** no commercetools client secret, session secret, seeding credential or Pexels key appears in either, and no such variable carries the public prefix

#### Scenario: Connection check available in development only
- **GIVEN** the health route that exercises the commercetools connection
- **WHEN** a production build is made
- **THEN** the route is absent from it

## Components

| Component | Notes |
| --- | --- |
| Next.js `^16` App Router, TypeScript | Latest stable at the time of writing is 16.4.0; never a 15.x line |
| `next-intl` `^4` locale routing | `localePrefix: 'always'`, locales derived from one config object |
| Tailwind CSS v4 via `@tailwindcss/postcss` | No config file; theme tokens declared in `@theme` in `globals.css`; scaffold with Tailwind disabled so v3 is not installed |
| `@commercetools/platform-sdk` and `@commercetools/ts-client` | Pinned to the majors the skill documents; see commercetools notes |
| `swr`, `jose` | Client state and signed session cookie, per the Next.js stack adapter |
| `.env.example` | Names every variable, holds no value, marks which are server-only |
| Malva theme tokens | Colour, type and spacing tokens in `@theme`; the single place brand values live. Values are the Telecom design system's `design/source/_ds/tokens.css`, carried verbatim — see `design-system-tokens` |
| Repository layout | `site/` storefront, `seed/` data seeding (see `seeding-framework`), `openspec/`, deploy config at the repo root |
| Deploy config | `netlify.toml` or `vercel.json` at the repo root with the build scoped to `site/`, Node 22 |
| Scaffold | Produced with the `/nextjs-setup-project` command of the commercetools skill, then adapted; not hand-assembled |

## commercetools

**Entities:** `Project`, `ApiClient`

**Verified API surface**

- (rest) The storefront reaches commercetools only through the TypeScript SDK client built from a client id, secret, auth URL and API URL held in server-only environment variables — [docs](https://docs.commercetools.com/api/dev-tooling/ts-sdk-getting-started)

**Constraints that change the design**

- The commercetools skill pins `@commercetools/platform-sdk` to `^8` and `@commercetools/ts-client` to `^4`. The registry's latest majors at the time of writing are 9.6.0 and 5.1.0. Bootstrap installs the pinned majors; moving to a newer major is a separate, explicit change checked against the skill's client and login patterns, not a side effect of `npm install`.
- The storefront API client must be the restricted Frontend-style client with no admin scopes. The seeding credential is a different, broader client and must never be configured for `site/`.
- Next.js image optimisation query parameters are rejected by the commercetools image CDN, so `images.unoptimized` stays `true`. The skill's default `remotePatterns` wildcard is narrowed here to the hosts actually used (the commercetools CDN and `images.pexels.com`).

**Modeling notes**

The bootstrap should be the output of the skill's scaffold command followed by a small, reviewable diff: Malva tokens, the narrowed image hosts, the repo-root deploy file, and the environment validation. Keeping the scaffold output recognisable is what lets later skill updates be compared against it.

## commercetools skills

Load `commercetools-storefront` (Next.js stack adapter) before implementing this capability. Supporting: `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which deploy target is primary, Netlify or Vercel? Both configs are cheap, but only one should be kept live.
- Which markets and currencies ship first? This spec and its siblings assume `en-US` and `USD`; see `locale-and-market` assumptions in `seed-shipping-and-market-settings`.
- Is the newer `platform-sdk` 9 / `ts-client` 5 line acceptable for this project, or should it stay on the skill's pinned majors until the skill is updated?
