## ADDED Requirements

### Requirement: One owner of the catalog
This repository SHALL be the only pusher of the page-builder catalog for this commercetools project. The catalog SHALL live in the repository as a JSON file validated against the schema shipped in `@commercetools-labs/page-builder`.

#### Scenario: Schema validation
- **WHEN** the catalog file is edited
- **THEN** validation reports every violation at once and passes only if types, references and sections are valid

### Requirement: Catalog matches the component map
Every key in the storefront's component map SHALL be in the catalog. The catalog that is pushed SHALL contain only types the map has a component for; a catalog type without a component is held back, listed in the push output, and offered to authors only when a later phase adds its component. A test SHALL enforce both rules and SHALL list the held-back types explicitly, so adding a type to the catalog or a component to the map forces that list to change.

#### Scenario: Catalog type without a component
- **WHEN** the catalog contains `listing/facets` and the map lacks it
- **THEN** a push omits it, names it in the output, and authors do not see it in the palette

#### Scenario: Component without a catalog entry
- **WHEN** the map gains a key that is not in the catalog
- **THEN** the test fails

### Requirement: Pipeline order
The pipeline SHALL run validate on change requests (writes nothing), and on the main branch SHALL deploy the storefront, then push the catalog, then publish it. Push SHALL NOT run before the deploy finishes.

#### Scenario: Change request
- **WHEN** a change request edits the catalog
- **THEN** only validate runs and nothing is written to the project

#### Scenario: Deploy fails
- **WHEN** the storefront deploy fails
- **THEN** the push and publish steps do not run

### Requirement: Explicit approval for writes
The first push and any publish that writes into the commercetools project SHALL be confirmed by the owner before it runs. The admin secret SHALL come from the CI secret store.

#### Scenario: First push
- **WHEN** the catalog is about to be pushed for the first time
- **THEN** the exact catalog contents and target project are shown and a yes is recorded before the call is made

### Requirement: Secrets rotation and upgrades documented
The repository docs SHALL state how the render key, preview token and admin secret are rotated, who holds them, and the upgrade order for the wire version (service first, then client).

#### Scenario: Render key rotation
- **WHEN** the render key changes
- **THEN** the docs list the service and every client environment that must be updated together

### Requirement: Verification recorded
End-to-end results SHALL be recorded in the repository docs: every page type in both markets on desktop and small screen, draft preview, wrong token, edit mode, service-stopped behavior, wrong-URL behavior, p95 latency of the render call against the 2000 ms budget on a production-type deployment, and absence of preview flags on shopper paths.

#### Scenario: Latency on a sandbox deployment
- **WHEN** the service runs as a scale-to-zero sandbox deployment
- **THEN** the result is marked as not representative of production latency
