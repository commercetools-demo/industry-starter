<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream J: Vehicle finder and garage

**Depends on:** E (parts catalog with fitment data, vehicle catalog), I (shell, `components/ui`, session `branchKey`).
**Implements:** `cs/design-vehicle-finder-and-garage` (primary).
**Skills:** `commercetools-storefront` (`core/search-facets.md`, `core/data-loading.md`, `core/customer-auth.md`), `commercetools-platform` (`product-search.md`, custom objects, custom types), `commercetools-commerce-patterns` (catalog architecture: flat searchable attributes).
**Apps and paths:** everything below lives in `b2b2c-automotive/storefront/`. Run commands from that directory.

## 1. Goal

A shopper identifies a vehicle (first by year, make, model, engine in dependent selectors; later by plate or VIN through a provider interface with a default stub), the vehicle is saved in a garage with one vehicle active, and every other workstream can ask two questions: "what is the active vehicle?" and "does this part fit it?". Fit-only is the default once a vehicle is active. This workstream owns the vehicle catalog read model, the garage, the fitment query builder and fit-state function used by K, L and M.

## 2. Specs and requirements implemented

| Id | Spec path | Requirement title |
| --- | --- | --- |
| J-R1 | `openspec/specs/consumer-storefront/design-vehicle-finder-and-garage/spec.md` | Three ways to identify a vehicle (scenarios: Plate lookup resolves one vehicle, Plate matches several engines, Lookup fails) |
| J-R2 | same | Garage persists across sessions (scenario: Merge at sign-in) |
| J-R3 | same | Fitment filters what is offered (scenarios: Default is fit-only, Turning the filter off, No vehicle yet) |
| J-R4 | same | Always correctable (scenario: Change on the product page) |

Context: `consumer-storefront/design-home-page` (finder card), `design-product-listing-page` (garage bar, filter), `design-product-detail-page` (fit banner), `bootstrap-and-structure` (reserved `lib/ct/vehicles`, `hooks/useGarage.ts`, `GarageProvider`). Existing component study: `design-systems/automotive/components/car-lookup.html`.

## 3. Design decisions already taken

| # | Decision | Source |
| --- | --- | --- |
| D1 | Fit-only by default once a vehicle is active; the "Fits my vehicle" filter can be turned off. | design.md decision 5; spec "Gaps and decisions" (default taken, Q-J02) |
| D2 | Fitment is locked master data; resellers cannot change it. | `design-vehicle-finder-and-garage` "Gaps"; `seller-portal/design-product-info-tailoring` |
| D3 | Fitment is product data in flat, searchable attributes (not nested, not free text): the set attribute `fitment-keys` (one text key per vehicle generation and engine) and the boolean `universal-fit`, exactly as the seed (workstream E) writes them. | spec "Platform notes"; `commercetools-commerce-patterns` "Nested attributes are not searchable"; `seed/src/data/vehicles.ts` |
| D4 | Fit badge colours and glyphs are locked (✓ success tint, ✕ danger tint); they ignore the reseller theme. | `theming-design` "Locked tokens and unsupported theme fields" |
| D5 | Plate and VIN are later steps behind a provider interface; **the mock provider is the only provider** (owner answer Q-002 and Q-J01: no real decoding service, no credentials); the selector route ships first. | owner-answers Q-002; brief and design.md section 5 row 3 |
| D6 | Anonymous garage in a cookie; signed-in garage in a **customer custom field** (JSON, **max 5 vehicles**); merged on sign-in with one active vehicle (owner answer Q-J04, matches the plan). | owner-answers Q-J04; spec "Garage persists across sessions" |
| D7 | **Fitment is year ranges** (owner answer Q-J03): a part fits `make, model, year-from, year-to, engine` ranges. A vehicle the shopper picks is `{make, model, year, engine}` with one stable string id (section 4.1). The vehicle selector, the fit filter, the fit badge and the compatible-vehicle list all work from the ranges (section 4.4). | owner-answers Q-J03; seed `fitment-keys` |
| D8 | The URL carries `fit=0` only (filter off); it never carries the vehicle, so a shared link is evaluated against the opener's vehicle. | `design-product-listing-page` "Filters held in the address" |
| D9 | Selector order is Make, Model, Year, Engine (design shows Year first); confirmed default in Q-J05. | `design-vehicle-finder-and-garage` Components; this plan |

## 4. The fitment model (concrete)

### 4.1 Vehicle id
`{make}.{model}.{year}.{engine}`, each part a lowercase slug of `[a-z0-9-]+` (the engine `2.0 TDI` becomes `2-0-tdi`), for example `volkswagen.golf.2016.2-0-tdi`. Regex: `/^[a-z0-9-]+\.[a-z0-9-]+\.\d{4}\.[a-z0-9-]+$/`. The id is what the garage stores and what URLs and hooks pass around; it identifies a **vehicle the shopper owns** (one year), never a range. Types in `lib/types.ts`:
```ts
export type VehicleId = string;
export interface Vehicle { id: VehicleId; make: string; model: string; year: number; engine: string; label: string } // label: "2016 Volkswagen Golf · 2.0 TDI"
// Garage = the seed's `malva-customer.garage` JSON, verbatim (`plans/SEED-PLAN.md` 3.2): { "vehicles": [ { id, make, model, year, engine, fitmentKey } ], "activeId": "<id>" }. Max 5 vehicles; array order is add order (newest last), there is no `addedAt`. The cookie holds the same shape.
export interface GarageVehicle { id: VehicleId; make: string; model: string; year: number; engine: string; fitmentKey: string; nickname?: string /* optional, written only by the storefront (account rename, Q-08, max 40 characters); the seeded JSON never has it, parsers must keep unknown optional keys */ } // year = the shopper's own year (inside the key's range); fitmentKey = the join to parts (a vehicle-table `fitmentKey`)
export interface Garage { vehicles: GarageVehicle[]; activeId: VehicleId | null } // max 5
export interface FitmentRange { make: string; model: string; yearFrom: number; yearTo: number; engine: string } // inclusive years
export interface FitmentProduct { fitmentKeys: string[]; universalFit: boolean }
```

### 4.2 Product attributes (product type `mau-pt-part`, seeded by E; read-only here)
Names are the seed's (`seed/src/data/product-types.ts`); L and M use the same names (the kebab-case attribute names, not camelCase).
| Attribute | Type | Searchable | Meaning |
| --- | --- | --- | --- |
| `fitment-keys` | set of text | yes | one **range key** per vehicle generation and engine: `make\|model\|year-from\|year-to\|engine`, for example `Volkswagen\|Golf\|2012\|2019\|2.0 TDI` (years inclusive) |
| `universal-fit` | boolean | yes | universal part (fluids, wiper blades): fits every vehicle |
| `part-number`, `oem-numbers`, `brand`, `quality-tier`, `position`, `warranty-months` | see L | yes | used by L and M |

Search field paths: `variants.attributes.fitment-keys` with `fieldType: 'set_text'`; `variants.attributes.universal-fit` with `fieldType: 'boolean'`. Attributes are read from the master variant. Local (reseller-owned) parts carry no `fitment-keys` and never match fit-only (they can still be bought; their card shows "Select your vehicle to check fit" or the unknown state; recorded in L). If E has not delivered these exact names, stop at task J-00 and report; do not rename in the storefront.

### 4.3 Vehicle table (Custom Objects, seeded by E)
Container `mau-vehicles`, one object per generation and engine, key `mau-veh-<slug of make model generation engine>`, value `{ make, model, generation, yearFrom, yearTo, engine, markets: ('DE'|'US')[], fitmentKey }` where `fitmentKey` is exactly the text stored in a part's `fitment-keys` (`seed/src/data/vehicles.ts`). About 26 records. `lib/ct/vehicles.ts` reads the whole container once (`apiRoot.customObjects().get({ queryArgs: { where: 'container="mau-vehicles"', limit: 500 } })`, `unstable_cache` 3600 s, tag `vehicle-table`) and builds an in-memory catalog; the **dependent selectors are derived from the ranges**: makes, models per make, **years = every year from `yearFrom` to `yearTo` of any record of that make and model** (descending), engines = the engines of the records whose range contains the chosen year (`markets` filtered by the store country). Selecting year 2019 for a Golf offers the engines of both Golf VII and Golf VIII. Fit never reads the vehicle table for the part side (it reads the part's own `fitment-keys`). There is no explicit per-year vehicle id on the part and no expansion of a range into years in the seed: the seed holds only range keys (`fitment-keys`, `universal-fit`) and this table; every range expansion described below happens in the storefront against the table.

### 4.4 How ranges are queried and evaluated (exported from `lib/search/fitment.ts` and `lib/vehicles/fitment-keys.ts`, used by K, L and M)
Product Search cannot answer "year between from and to" over a text attribute, and nested attributes are not searchable. The plan therefore **resolves the range on the vehicle side, with the small vehicle table, and matches on the part side by exact range key**:

1. The part carries the range keys of the generations it fits (seed rule: every key of a part is a `fitmentKey` of a vehicle-table record; a seed verify test already asserts it). A part never carries a hand-written range that is not a vehicle-table record, which keeps this exact.
2. The active vehicle `{make, model, year, engine}` is **expanded into keys**: `expandVehicleToKeys(vehicle, records): string[]` returns the `fitmentKey` of every record with the same make, model and engine whose `yearFrom <= year <= yearTo`. Usually one key; two when generations overlap in a year (Golf VII and VIII both cover 2019 for `2.0 TDI`).
3. The search expression is an exact match on any expanded key, or universal:
```ts
import type { SearchQuery } from '@commercetools/platform-sdk';

export function fitExpression(keys: string[]): SearchQuery {
  return { or: [
    { exact: { field: 'variants.attributes.fitment-keys', fieldType: 'set_text', values: keys } },
    { exact: { field: 'variants.attributes.universal-fit', fieldType: 'boolean', value: true } },
  ]};
}
export type FitMode = 'fit-only' | 'all';
/** No vehicle -> no expression. Vehicle + fit-only -> fitExpression(keys). Vehicle + all -> no expression (fit shown per card). `keys` empty (vehicle not in the table) -> only the universal branch. */
export function fitScope(keys: string[] | null, mode: FitMode): SearchQuery | null;

export type FitState = 'fits' | 'does-not-fit' | 'unknown';
export function parseFitmentKey(key: string): FitmentRange | null;                     // 5 parts split on '|', years integers, yearFrom <= yearTo, else null
export function vehicleInRange(v: { make: string; model: string; year: number; engine: string }, r: FitmentRange): boolean; // same make, model, engine (exact, case-sensitive as seeded) and yearFrom <= year <= yearTo
/** unknown when no vehicle. Pure; reads the mapped product (range keys), never calls commercetools. Does not need the vehicle table. */
export function getFitState(product: FitmentProduct, vehicle: { make: string; model: string; year: number; engine: string } | null): FitState;
export function resolveFitMode(vehicle: unknown | null, fitParam: string | undefined): FitMode; // fit=0 -> 'all', else vehicle ? 'fit-only' : 'all'
export function groupRangesForDisplay(keys: string[]): Array<{ make: string; model: string; yearFrom: number; yearTo: number; engines: string[] }>; // for the compatible-vehicle list (M-07)
```
The expression goes into `query` (not `postFilter`), so facet counts reflect fit. `getActiveVehicle()` (J-11) returns the vehicle together with its expanded `fitKeys`, so L, K and M never touch the table. **Consistency rule:** the Search path (exact keys) and the pure path (`vehicleInRange`) must agree; a test enumerates every vehicle-table record and every year of its range and asserts that `expandVehicleToKeys` contains the record's key exactly when `vehicleInRange(v, parseFitmentKey(key))` is true, and the MCP check in 7.1 compares search totals with a count computed by the pure function over the products read back. **Fallback if Search rejects `values` on a `set_text` exact (J-00 check):** use one `exact` with `value` per key inside the `or`; if exact on text keys containing `|` or spaces misbehaves (J-00 check with a seeded key), do not touch the seed: record the outcome in `plans/evidence/J/mcp-checks.md`, stop, and raise the conditional seed request below with the coordinator.

### 4.5 Provider interface (plate and VIN, later steps)
`lib/vehicles/provider.ts`:
```ts
export type LookupResult =
  | { status: 'resolved'; vehicle: Vehicle }
  | { status: 'needs-engine'; make: string; model: string; year: number; engines: Array<{ key: string; label: string }> }
  | { status: 'not-found' }
  | { status: 'invalid'; reason: 'plate-format' | 'vin-length' | 'vin-characters' }
  | { status: 'unavailable' };
export interface VehicleLookupProvider {
  readonly id: string;                                    // 'stub' by default
  lookupPlate(input: { plate: string; country: 'DE' | 'AT' | 'CH' | 'US' }): Promise<LookupResult>;
  lookupVin(input: { vin: string }): Promise<LookupResult>;
}
```
`lib/vehicles/providers/stub.ts` is the default (`VEHICLE_PROVIDER=stub`). Fixtures (fictional, documented in the file; vehicles exist in the seed's vehicle table): plate `B-AB 1234` in DE resolves to `volkswagen.golf.2016.2-0-tdi`; plate `HH-XY 99` in DE returns `needs-engine` for Volkswagen Golf 2016 (engines `1.4 TSI`, `2.0 TDI`); a US fixture plate `7ABC123` in US resolves to `toyota.camry.2020.2-5`; any other well-formed plate is `not-found`; VIN `WVWZZZAUZGW000001` resolves to the same Golf 2016 `2.0 TDI`; any other 17-character VIN is `not-found`. The mock is the only provider (owner answer Q-002): there is no real adapter, no credentials and no OA-04 step; the UI marks mock results with the text "Demo lookup". Validation before the provider is called (`lib/vehicles/validate.ts`): plate trimmed, 2 to 10 characters from `[A-Z0-9 -]` after upper-casing, else `invalid plate-format`; VIN upper-cased, exactly 17 characters else `vin-length`, containing I, O or Q (or any non-alphanumeric) else `vin-characters`; no check-digit validation (only North American VINs carry a mandatory one). `lib/vehicles/index.ts` `getProvider()` picks by env; unknown value throws at startup (only `stub` exists). `VEHICLE_LOOKUP_ENABLED=true|false` (default `true` outside production, `false` in production) toggles the plate and VIN tabs. Because the mock is the only provider, a demo deployment may want the tabs on: gate script `scripts/check-vehicle-provider.mjs` fails a production build when `VEHICLE_LOOKUP_ENABLED=true` and `VEHICLE_PROVIDER=stub` **unless** `VEHICLE_MOCK_ACKNOWLEDGED=true` is also set (explicit demo opt-in, printed in the build log), so nobody sees fake lookups by accident.

### 4.6 Garage storage and merge
- Anonymous: HTTP-only cookie `garage` (`sameSite: lax`, `path: /`, 180 days), value `JSON` of `Garage` (the seed shape above), parsed with zod, every entry re-validated against the vehicle table (`mau-vehicles`: the `fitmentKey` is a table record and the year is inside its range) on read; bad entries dropped; more than 5 entries are cut to 5 keeping the active one.
- Signed in: a **customer custom field** (owner answer Q-J04): the seed's custom type `malva-customer` (never `customer-garage`, never created here) with field `garage` (multi-line String, JSON of `Garage`, never more than 5 vehicles, enforced by `parseGarage` and the write route). The four seeded shoppers already have the type and a garage. Read with `apiRoot.customers().withId().get()`; write `setCustomField` (`name: 'garage'`); when a customer has no custom type yet, `setCustomType` with `type: { key: 'malva-customer' }` and `fields: { garage }` first. `malva-customer` also holds `preferredBranchKey`, `mobile`, consent fields (Q): `setCustomField` never touches them.
- Merge, pure, in `lib/vehicles/garage.ts`:
  ```ts
  export const GARAGE_MAX = 5;
  export function mergeGarages(account: Garage, anonymous: Garage): Garage;
  ```
  Rules: account vehicles first in their order, then anonymous vehicles not already present (union by id, no duplicates); `activeId` = anonymous `activeId` if the anonymous garage had one, else the account's; if the union exceeds 5, keep the active vehicle and the others latest in array order (no timestamp exists). `mergeGarageOnSignIn(customerId, anonymousGarage)` in `lib/ct/vehicles.ts` reads the account garage, merges, writes it back, and returns the result; the sign-in route handler (built in Q) calls it and clears the anonymous cookie. Until Q exists, only the function and `POST /api/garage/merge` (session must have `customerId`) exist.

## 5. Tasks (test first)

Stage 1 (J-01 to J-14) delivers selectors, garage, fit helpers. Stage 2 (J-15 to J-18) adds plate and VIN. K and L need Stage 1 only.

- [ ] **J-00 Preconditions.** MCP checks of section 7.1: attributes `fitment-keys`, `universal-fit` exist and are searchable; `mau-vehicles` objects exist; custom type `malva-customer` has the field `garage` and the seeded shoppers carry a garage. Run the two query checks of 4.4 (`values` on a `set_text` exact; a key containing `|` and a space) and write the outcome to `plans/evidence/J/mcp-checks.md`. `npm run check` is green. [SPEC: J-R3]
- [ ] **J-01 Types and slugs.** `lib/types.ts` additions of 4.1; `lib/vehicles/id.ts`: `buildVehicleId(parts)`, `parseVehicleId(id): {make,model,year,engine} | null`, `isVehicleId(s)`. Test `lib/vehicles/id.test.ts`: `builds and parses round trip`, `rejects uppercase and spaces`, `rejects three-part ids`. [SPEC: J-R1]
- [ ] **J-02 Vehicle table read model (ranges).** `lib/ct/vehicles.ts` (server-only): `listVehicleRecords()` (4.3, one container read), `buildCatalog(records, market)` (pure, in `lib/vehicles/catalog.ts`: makes, models, years from ranges, engines per year), `getVehicleById(id): Promise<Vehicle | null>` (a vehicle exists when some record has the slugged make, model and engine and the year is inside its range), `resolveVehicles(ids): Promise<Vehicle[]>` (one table read for all ids), `expandVehicleToKeys(vehicle, records): string[]` (4.4), all through `unstable_cache` (3600 s, tag `vehicle-table`). `lib/mappers/vehicle.ts`: labels `"{year} {Make} {Model} · {engine}"`. Tests with mocked `apiRoot` and fixtures copied from `seed/src/data/vehicles.ts`: `one table read for many ids`, `unknown id returns null`, `year outside every range returns null`, `label format`, `years come from the ranges descending` (Golf: 2012 to 2024), `year 2019 offers the engines of both generations`, `markets filter the catalog`, `expand gives one key inside one generation`, `expand gives two keys where generations overlap` (Golf 2019 2.0 TDI), `expand is empty for a year the table does not cover`. [SKILL: commercetools-platform] [SPEC: J-R1, J-R4]
- [ ] **J-03 Options endpoint (dependent selectors).** `app/api/vehicles/options/route.ts` `GET ?make=&model=&year=`: no params returns makes; `make` returns models; `make&model` returns years (descending, expanded from the ranges); `make&model&year` returns engines (records whose range contains the year) with the resulting `vehicleId`. Validate with zod; unknown key returns 404 `{ error: 'unknown-option' }`. Responses cacheable (`Cache-Control: public, max-age=300`). Test `route.test.ts`: `returns makes`, `models need a valid make`, `years descending and cover the whole range`, `engines depend on the year`, `engines carry vehicle ids`, `unknown make 404`. [SKILL: commercetools-storefront] [SPEC: J-R1]
- [ ] **J-04 Fitment helpers (ranges).** `lib/vehicles/fitment-keys.ts` (`parseFitmentKey`, `vehicleInRange`, `groupRangesForDisplay`) and `lib/search/fitment.ts` exactly as 4.4. Tests `lib/vehicles/fitment-keys.test.ts`: `parses a five part key`, `rejects a key with four parts or reversed years`, `engine with a dot and space survives`, `year equal to from and to is inside`, `year one outside is not`, `different engine does not fit`, `groups ranges for display by make and model`, `expansion and range test agree for every vehicle record and year` (4.4 consistency rule); `lib/search/fitment.test.ts`: `fit-only builds an or of the expanded keys and universal-fit`, `two keys go into one values list`, `no vehicle builds nothing`, `mode all builds nothing`, `fit=0 turns the filter off`, `getFitState fits inside the range`, `getFitState does not fit a year outside the range`, `getFitState fits by universal-fit`, `getFitState does not fit another engine`, `getFitState is unknown without a vehicle`, `local part without keys does not fit and is not universal`, `vehicle missing from the table gets only the universal branch`. Scenarios "Default is fit-only", "Turning the filter off", "No vehicle yet" are covered here and in L's page tests. [SKILL: commercetools-platform] [SPEC: J-R3]
- [ ] **J-05 Garage pure logic.** `lib/vehicles/garage.ts`: `emptyGarage()`, `addVehicle(garage, vehicle: GarageVehicle)` (becomes active; duplicate id re-activates and does not duplicate; sixth vehicle drops the first non-active in array order; the caller builds `fitmentKey` from the vehicle table: the first record whose range contains the year), `removeVehicle`, `setActive`, `mergeGarages` (4.6), `parseGarage(json, isKnownId)`. Test `lib/vehicles/garage.test.ts`: `merge gives three vehicles without duplicates` (scenario "Merge at sign-in": anonymous 1 distinct vehicle plus account 2 gives 3), `merge drops a vehicle present on both sides`, `previously active vehicle stays active`, `account active used when anonymous had none`, `cap of five keeps the active`, `bad json yields an empty garage`, `unknown id dropped`. [SPEC: J-R2]
- [ ] **J-06 Garage BFF.** `lib/session` helper `readAnonymousGarage()` / `writeAnonymousGarage()` in `lib/vehicles/cookie.ts`. Routes in `app/api/garage/`: `route.ts` (`GET` returns `{ garage, vehicles: Vehicle[], active: Vehicle | null }`; `POST { vehicleId }` adds and activates; `DELETE ?vehicleId=` removes), `active/route.ts` (`POST { vehicleId }`), `merge/route.ts` (`POST`, requires `customerId`). Signed-in requests read and write the customer's `garage` field; anonymous use the cookie. Every `vehicleId` is validated against the catalog before it is stored (400 otherwise). `mergeGarageOnSignIn` in `lib/ct/vehicles.ts` (409 retry with fresh version, as the skill says). Tests: `rejects an unknown vehicle id`, `anonymous add sets the cookie`, `signed-in add writes the customer field`, `merge route needs a session customer`, `delete of the active vehicle activates the newest remaining`. [SKILL: commercetools-storefront] [SPEC: J-R2]
- [ ] **J-07 Client state.** `lib/cache-keys.ts` key `GARAGE`; `hooks/useGarage.ts` (SWR; returns `{ garage, active, vehicles, addVehicle, setActive, remove, isLoading }`; mutations use optimistic update then revalidate); `context/GarageProvider.tsx` with `SWRConfig` fallback from a server read so first paint has no flash; mount it in `app/[locale]/[store]/layout.tsx` (edit the file I created: add the provider only). `app/[locale]/[store]/layout.tsx` also passes the server-read garage as `fallback`. Test `hooks/useGarage.test.tsx`: `addVehicle makes it active`, `setActive switches`, `remove updates the list`. [SPEC: J-R2]
- [ ] **J-08 Selector component.** `components/vehicle/VehicleSelectors.tsx` (client): four dependent selects, 44 px, `Public Sans` field font via tokens. The design (`vehicleFields`) shows the order Year, Make, Model, Engine; the catalog is keyed by make, so the build order is Make, Model, Year, Engine (each select is disabled until the one before it is chosen). This is a deliberate deviation from the design order (D9, Q-J05); the labels stay "Year", "Make", "Model", "Engine". Implement the dependency in a reducer `lib/vehicles/selectorReducer.ts` (`select(level, key)` clears every lower level). Button "Verify fitment" (pill radius `--radius-pill`) enabled only when all four are set; on press calls `addVehicle`. Test `VehicleSelectors.test.tsx`: `models load after make`, `changing make clears the rest`, `verify is disabled until engine chosen`, `verify adds and activates the vehicle`, `no axe violations`; reducer test `selectorReducer.test.ts`. [SPEC: J-R1]
- [ ] **J-09 Garage chip and finder card.** `components/vehicle/GarageChip.tsx` (`--color-success-50` fill, text "2016 Volkswagen Golf · 2.0 TDI", "Change" link in `--font-utility`), `components/vehicle/VehicleFinderCard.tsx` (title "Find parts for your vehicle"; empty garage shows `VehicleSelectors`; otherwise shows the active vehicle with "Change" and a "Shop parts that fit" button linking to `/{locale}/{store}/parts`; a "My garage" list of up to five vehicles with "Set active" and "Remove" when more than one), `components/vehicle/ChangeVehicleDialog.tsx` (uses `Modal` from I; contains selectors and the garage list). K embeds `VehicleFinderCard`; L and M embed `GarageBar` and `FitBanner` (J-10). Tests: `empty garage shows selectors`, `saved vehicle shows chip Change and Shop parts that fit` (home scenario), `change opens the dialog and keeps focus management`, `five vehicles cap shows a message when adding a sixth`. [SPEC: J-R1, J-R2, J-R4]
- [ ] **J-10 Fit badge, garage bar, fit banner, fit toggle.** `components/vehicle/FitBadge.tsx` (props `state: FitState`; `fits` renders "✓ Fits your vehicle" on `--color-success-50` with success text; `does-not-fit` "✕ Does not fit" on `--color-danger-50`; `unknown` "Select your vehicle to check fit" neutral, as a button that opens `ChangeVehicleDialog`; glyph is in the DOM text and not colour-only), `GarageBar.tsx` (listing bar: "My garage", chip, "Change vehicle"; with no vehicle shows "Select your vehicle" and the selectors in a collapsed row), `FitBanner.tsx` (PDP: success banner "✓ Fits your 2016 Volkswagen Golf 2.0 TDI" or danger banner with link "View fitting alternatives" to `/{locale}/{store}/parts?fit=1&...` supplied as prop `alternativesHref`), `FitToggle.tsx` ("Fits my vehicle" checkbox that writes `fit=0` or removes it via `useRouter().replace` keeping other params; rendered only when a vehicle is active). Tests: `badge texts per state`, `does not follow the theme` (render with a `--color-danger-500` override on `:root` style and assert the badge class uses the locked token), `unknown badge opens the dialog`, `banner shows alternatives link for non fit`, `toggle writes fit=0 and keeps brand and sort`, `quantity stays when the vehicle changes on a PDP` (scenario "Change on the product page": the component receiving `children` state must not remount; assert the sibling quantity input keeps its value). [SPEC: J-R3, J-R4]
- [ ] **J-11 Server helper for pages.** `lib/vehicles/active.ts` (server-only): `getActiveVehicle(): Promise<(Vehicle & { fitKeys: string[] }) | null>` reads the garage (cookie or customer) once per request with React `cache()` and expands the active vehicle to its range keys with `expandVehicleToKeys` (J-02), so L, K and M never read the garage or the vehicle table twice and pass `fitKeys` straight to `fitScope`. Test: `returns fit keys for the active vehicle`, `second call in one request reads once`. [SKILL: commercetools-storefront] [SPEC: J-R3]
- [ ] **J-12 Messages.** Add every string to both catalogs under `vehicle.*` (de-DE and en-US); `npm run check` passes `check-messages`. [SPEC: J-R1]
- [ ] **J-13 Locked fit tokens.** Do not add tokens: `app/tokens.css` must stay byte-identical to the kit (`check-tokens`). Use `--color-success-50`, `--color-success-600`, `--color-danger-50`, `--color-danger-600` directly in the fit components, and add a unit test `lib/theme/locked-tokens.test.ts` that the theme adapter output (from H) never contains `--color-success-` or `--color-danger-` declarations. [SPEC: J-R3]
- [ ] **J-14 Stage 1 gate.** `npm run check`, `npm run build`, browser recipe 7.2 steps 1 to 8, MCP checks 7.1. Tick before starting Stage 2.
- [ ] **J-15 Validators and provider interface.** `lib/vehicles/validate.ts`, `lib/vehicles/provider.ts`, `lib/vehicles/providers/stub.ts`, `lib/vehicles/index.ts` as in 4.5. Tests `validate.test.ts`: `plate trimmed and upper-cased`, `plate with symbols is invalid`, `vin of 16 characters is invalid`, `vin with letter I is invalid`, `valid vin passes`; `stub.test.ts`: `known plate resolves`, `second plate needs engine`, `unknown plate not found`, `known vin resolves`; `index.test.ts`: `unknown provider id throws`. [SPEC: J-R1]
- [ ] **J-16 Lookup endpoint.** `app/api/vehicles/lookup/route.ts` `POST { type: 'plate', plate, country } | { type: 'vin', vin }`: validate, call provider, return the `LookupResult` JSON with HTTP 200 (a failed lookup is a result, not an error); never save to the garage here (saving is the shopper's confirmation). Rate limit with an in-memory token bucket per session (10 per minute) returning 429. Provider exceptions become `{ status: 'unavailable' }` and are logged without the plate or VIN. Tests: `valid plate returns resolved`, `invalid vin is invalid and never reaches the provider`, `provider error becomes unavailable`, `rate limit returns 429`, `nothing is saved`. [SKILL: commercetools-storefront] [SPEC: J-R1]
- [ ] **J-17 Plate and VIN UI.** `components/vehicle/PlateVinTabs.tsx`: tabs "Make, model, year" (default), "Plate", "VIN"; shown only when `VEHICLE_LOOKUP_ENABLED`. Plate tab: country select and plate field, "Look up" button. Resolved result shows "2016 Volkswagen Golf · 2.0 TDI" and the note "Demo lookup" with "Save to garage" and "Not my car"; `needs-engine` shows an engine select and keeps parts unfiltered until chosen; `not-found` and `invalid` show plain-language messages ("We could not find that plate. Check it or choose your vehicle by make, model and year." with a link switching to the first tab) next to the field with `aria-describedby`; nothing is saved on failure. Tests (`PlateVinTabs.test.tsx`): `plate resolves and asks for confirmation`, `plate matches several engines requires engine pick` (scenario "Plate matches several engines"), `lookup failure offers make model year route and saves nothing` (scenario "Lookup fails"), `vin with a bad length shows the error`, `tabs hidden when lookup disabled`. [SPEC: J-R1]
- [ ] **J-18 Production gate.** `scripts/check-vehicle-provider.mjs` (4.5) wired into `npm run check` and `.env.example` (`VEHICLE_PROVIDER`, `VEHICLE_LOOKUP_ENABLED`, `VEHICLE_MOCK_ACKNOWLEDGED` each with a one-line reason). Test the script with env fixtures: `production with lookup on and mock fails`, `production with lookup on, mock and acknowledgement passes and prints a notice`, `production with lookup off passes`, `development always passes`. [SPEC: J-R1]

## 6. Test-first scenario checklist

| Spec scenario | Test |
| --- | --- |
| Plate lookup resolves one vehicle | `PlateVinTabs.test.tsx` `plate resolves and asks for confirmation` |
| Plate matches several engines | `PlateVinTabs.test.tsx` `plate matches several engines requires engine pick` |
| Lookup fails | `PlateVinTabs.test.tsx` `lookup failure offers…`; `lookup/route.test.ts` |
| Merge at sign-in | `garage.test.ts` `merge gives three vehicles without duplicates`, `previously active vehicle stays active` |
| Default is fit-only | `fitment.test.ts` `fit-only builds an or…`; L page test |
| Turning the filter off | `fitment.test.ts` `fit=0 turns the filter off`; `FitBadge`/`ProductCard` tests in L |
| No vehicle yet | `fitment.test.ts` `getFitState is unknown…`; `FitBadge.test.tsx` `badge texts per state` |
| Change on the product page | `FitBanner.test.tsx` `quantity stays when the vehicle changes on a PDP`; browser step 9 |

## 7. Verification

### 7.1 `b2b2c-automotive` MCP checks
- `read_product_types` `where=key="mau-pt-part"`: attributes `fitment-keys` (set of text) and `universal-fit` (boolean), both `isSearchable: true`.
- `read_custom_objects` `container=mau-vehicles`: about 26 objects, each with `yearFrom`, `yearTo`, `engine`, `fitmentKey`; the vehicles of your recipe exist (Golf 2016 `2.0 TDI`, Golf 2019 `2.0 TDI` which is covered by two generations, one US vehicle).
- `read_types` `where=key="malva-customer"`: field `garage` (String, MultiLine); `read_customers` for a seeded shopper: `custom.fields.garage` parses to `{ vehicles: [{ id, make, model, year, engine, fitmentKey }], activeId }` and every `fitmentKey` exists in `mau-vehicles`.
- **Range query check.** `read_product_search` for the Golf 2016 `2.0 TDI` (one expanded key, `Volkswagen|Golf|2012|2019|2.0 TDI`): `{"query":{"or":[{"exact":{"field":"variants.attributes.fitment-keys","fieldType":"set_text","values":["Volkswagen|Golf|2012|2019|2.0 TDI"]}},{"exact":{"field":"variants.attributes.universal-fit","fieldType":"boolean","value":true}}]},"limit":0}`. Note the `total` in `plans/evidence/J/mcp-checks.md`. Then read the products (`read_products`, `fitment-keys`) and count with the pure rule (make, model, engine equal, year 2016 inside the range, or universal); the two numbers must be equal, and the finder recipe must reproduce the same count via L. Repeat for Golf 2019 `2.0 TDI` (two expanded keys in `values`; total equals the union, not the sum, of the two generations), for a vehicle whose year is just outside a part's range (the part must be absent), and for one more make (and one with universal parts only).
- After the recipe signs in as a seeded customer (needs Q; before that, run the merge unit test and call the route with a minted session in the test only): `read_customers` by id, the garage custom field contains the merged ids and at most 5 vehicles.

### 7.2 Chrome DevTools MCP recipe (base `http://localhost:3000`, store `<storeKeyA>`)
Save screenshots in `plans/evidence/J/`. Viewports 375×812, 768×1024, 1024×768, 1440×900.
1. `/en-US/<storeKeyA>` at 1440 with cleared cookies: the finder card shows the four selects (Make first enabled; Model, Year, Engine disabled) and "Verify fitment" disabled. Screenshot `finder-empty-1440.png`.
2. Choose Make "Volkswagen": `list_network_requests` shows `GET /api/vehicles/options?make=volkswagen` 200 and Model fills; choose Golf: the Year list runs from 2024 down to 2012 (every year of the ranges, not only generation edges); change Make to another and assert Model, Year, Engine are cleared (`take_snapshot`). Choose year 2019: Engine offers `1.5 TSI`, `1.4 TSI` and `2.0 TDI` once each (both generations).
3. Complete Volkswagen Golf 2016 2.0 TDI, press "Verify fitment": card becomes the chip "2016 Volkswagen Golf · 2.0 TDI" with "Change" and "Shop parts that fit". `evaluate_script` `document.cookie` does not show `garage` (HTTP-only), but `GET /api/garage` (fetch inside `evaluate_script`) returns the vehicle as `active`.
4. Reload: the chip is present on first paint (no empty-selector flash: assert the first `take_snapshot` after `wait_for` the chip text has no selects).
5. Click "Shop parts that fit": listing shows fit-only (count equals the MCP count from 7.1), every card "✓ Fits your vehicle". Range edge: change the active vehicle to a Golf 2019 `2.0 TDI` (covered by two generations) and then to a Golf 2020 (outside generation VII): a part that only fits generation VII (`2012` to `2019`) is listed for 2019 and absent for 2020, counts equal the MCP counts. Turn "Fits my vehicle" off: URL gains `fit=0`, non-fitting cards show "✕ Does not fit" and "View fitting alternatives". Reload keeps `fit=0`.
6. Clear cookies and open the listing: cards read "Select your vehicle to check fit"; no fit claim anywhere.
7. Add a second vehicle through "Change" (garage list shows two, the new one active); remove it: the first becomes active again.
8. Open a product page of a non-fitting part (M exists later; until then use the listing): ✕ state and link present. After M is built, repeat on `/p/<slug>`: type quantity 3, press "Change vehicle", select another vehicle, assert quantity still 3 and banner text updated.
9. Plate and VIN (stage 2, mock provider, results labelled "Demo lookup"): open the "Plate" tab, enter `B-AB 1234` DE: confirmation card "2016 Volkswagen Golf · 2.0 TDI"; "Save to garage" adds it. Enter `HH-XY 99` DE: engine select appears; before choosing, `GET /api/garage` unchanged. Enter `ZZ 0` : message with link back to selectors, garage unchanged. VIN tab with `WVWZZZAUZGW00000` (16 characters): length message. Screenshots `plate-resolved-1440.png`, `plate-error-375.png`.
10. 375 px and 768 px: selectors stack in one column, controls at least 44 px, no horizontal overflow (`scrollWidth <= innerWidth`). Screenshot `finder-375.png`.
11. Console clean (`list_console_messages` no errors) and Network shows no direct calls to commercetools hosts.

### 7.3 Manual rows for `plans/TODO-MANUAL-TESTING.md`
| Id | Who | What | Claude proceeds with |
| --- | --- | --- | --- |
| ~~OA-04~~ | removed | No decision or credentials needed: the mock plate and VIN provider is the only provider (owner answer Q-002, Q-J01). | n/a |
| M-J-1 | Owner | Confirm fit-only is the default once a vehicle is selected (design.md decision 5) | fit-only stays |
| M-J-2 | Owner | Compare finder card, garage chip and fit badges screenshots with `Reseller Storefront.dc.html` (`vehicleFields`, garage bar) | continue; differences become tasks |
| SO-01 | Owner | Sign off the plate, VIN and error screens (missing from the design, design.md section 6) | as built in J-17 |

Never wait silently: add the row, continue on the default, mention it in the PR description.

## 8. Definition of done
- J-00 to J-18 ticked; all named tests pass; `npm run check`, `npm run build` green; `check-vehicle-provider` passes in production mode with `VEHICLE_LOOKUP_ENABLED=false`.
- Recipe 7.2 completed with screenshots; MCP results recorded; `fitScope`, `getFitState`, `getActiveVehicle`, `FitBadge`, `GarageBar`, `FitBanner`, `FitToggle`, `VehicleFinderCard` exported and documented in a header comment for K, L, M.
- Hand-off note to Q (in the PR description): the sign-in route must call `mergeGarageOnSignIn(customerId, anonymousGarage)` and clear the anonymous cookie; Q's recipe must include the merge check.
- Questions Q-J01 (mock only), Q-J03 (ranges) and Q-J04 (customer field, cookie) are answered by the owner; Q-J02 and Q-J05 keep their defaults in `plans/notes/questions-IJKLM.md`.
- The range tests of J-04 pass, including the expansion/range agreement test, and the MCP range check (7.1) matches the pure count.

## 9. Evidence
`plans/evidence/J/`: `finder-empty-1440.png`, `finder-saved-1440.png`, `finder-375.png`, `finder-768.png`, `finder-1024.png`, `garage-two-vehicles-1440.png`, `listing-fit-1440.png`, `listing-nofit-1440.png`, `plate-resolved-1440.png`, `plate-error-375.png`, `mcp-checks.md`.

## Seed requests
Conditional (only if the J-00 query check fails; also in `plans/notes/seed-requests.md`): a flat searchable helper attribute on `mau-pt-part` holding one pipe-free, space-free token per fitment key (for example a slug of the key), so Product Search can match it exactly. Nothing else is needed: `fitment-keys`, `universal-fit`, `mau-vehicles` and `malva-customer.garage` exist in the seed.

## Progress

Storefront (J10, 2026-10-12). Unit-tested against mocks; browser-checked against a throw-away local fake of the commercetools endpoints (kept outside the repo); live checks are rows M-J-3 to M-J-6 in `plans/TODO-MANUAL-TESTING.md`. Evidence in `plans/evidence/J/` (`storefront-*.png`, `README.md`). Deviations are Q-J06 to Q-J10 in `plans/notes/questions-IJKLM.md`.

- J-00: partial (live MCP checks and the Search `values`/pipe query check deferred to M-J-3; `plans/evidence/J/mcp-checks.md` says so)
- J-01: done (`lib/vehicles/id.ts`)
- J-02: done (`lib/ct/vehicles.ts`, `lib/vehicles/catalog.ts`, `lib/mappers/vehicle.ts`; in-memory TTL cache, Q-J08)
- J-03: done (`app/api/vehicles/options`, `market` query parameter instead of a session read so the response can be public-cached)
- J-04: done (`lib/vehicles/fitment-keys.ts`, `lib/search/fitment.ts`, agreement test over every record and year)
- J-05: done (`lib/vehicles/garage.ts`; `parseGarage(json, resolveKey)` takes a table resolver instead of an id predicate)
- J-06: done (`lib/vehicles/cookie.ts`, `lib/vehicles/service.ts`, `app/api/garage`, `/active`, `/merge`; `mergeGarageOnSignIn`)
- J-07: done (`KEY_GARAGE`, `hooks/useGarage.ts`, `context/GarageProvider.tsx`, `components/vehicle/GarageRoot.tsx` mounted in the `[store]` layout; add is server-confirmed, set-active and remove are optimistic)
- J-08: done (`VehicleSelectors`, `selectorReducer`)
- J-09: done (`GarageChip`, `VehicleFinderCard`, `ChangeVehicleDialog`, `VehicleList`)
- J-10: done (`FitBadge`, `GarageBar`, `FitBanner` computes in the browser, `FitToggle`)
- J-11: done (`lib/vehicles/active.ts`)
- J-12: done (de-DE and en-US, five two-level namespaces, Q-J07)
- J-13: done (`lib/theme/locked-tokens.test.ts`; `tokens.css` untouched)
- J-14: partial (`npm run check` parts for J green; fake-endpoint browser recipe done, live parts M-J-3 to M-J-6)
- J-15 to J-18: done (`validate`, `provider`, stub, `index`, `app/api/vehicles/lookup`, `PlateVinTabs`, `scripts/check-vehicle-provider.mjs`, `.env.example`)
