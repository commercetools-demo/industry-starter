## Why

Specs `free-text-order-description-becomes-a-cart` and `order-input-becomes-a-named-shopping-list` promise that a signed-in client can turn a pasted or uploaded product list into a cart or a named shopping list. commercetools now offers this as the Intake agent (HTTP only, no SDK support). Clients also need to request a quote from a document (a purchase order PDF, a spreadsheet) in the same way. Intake keeps no history and has no status, so the storefront must track submissions itself.

## What Changes

- New signed-in-only **Intake** entry in the top bar and the mobile menu, next to Client portal and Request quote.
- New portal page `/account/intake`: a submit form (up to 3 files, optional free text, toggle Cart / Shopping list / Quote request, list-name field for Shopping list) and the list of recent intakes.
- New server route that calls `POST /{projectKey}/agents/intake/v1/responses` over raw HTTP (JSON, or multipart with a `payload` part and `files` parts), using a token with the new scope `manage_intake_agent`.
- Intake records persisted as Custom Objects per Business Unit: status (`processing` / `done` / `failed`), output type, file names, timestamps, warnings or error code, and a reference to the created entity (`entityType`, `id`, plus `cartId` for a Quote Request). Stale `processing` records are shown as failed after a threshold.
- After submitting, the client lands on the list with the new row In progress; the list refreshes until it settles.
- Scope `manage_intake_agent` added to `lib/scopes.ts`, its test and `.env.example`.
- Out of scope (deferred by the owner): row actions (open cart, convert list, and so on); verifying that the created entity belongs to the signed-in customer; any Intake list/get/delete (none exists).

Existing commercetools usage surveyed: `lib/ct/client.ts` builds the single SDK `apiRoot` (client credentials, `ts-client`); `lib/ct/portal-data.ts` already stores per-Business-Unit records as Custom Objects with keys `<businessUnitKey>.<id>` (scope `manage_key_value_documents`); `lib/api.ts` provides `handle`, `requireBusinessUnit` and a cross-site guard; quote requests already go through `lib/ct/quote-requests.ts`.

## Capabilities

### New Capabilities
- `intake-submission`: submit files and/or text to Intake for a chosen output type and record the outcome.
- `intake-history`: recent intakes list, statuses, entity references, stale handling.
- `intake-navigation`: signed-in header/mobile entry and the `/account/intake` route.

### Modified Capabilities
<!-- None. The two existing intake specs are fulfilled, not changed. -->

## Impact

- Code (`site/`): `components/layout/TopBar.tsx`, `MobileMenu.tsx`, new `IntakeButton`; `app/[locale]/account/(portal)/intake/`; `app/api/intake/`; new `lib/ct/intake.ts` (raw HTTP) and `lib/ct/intake-records.ts`; `lib/site.ts` routes; `components/portal/PortalNav.tsx`; `messages/*`; `lib/scopes.ts`, `lib/scopes.test.ts`, `.env.example`.
- APIs: commercetools Intake API (new), Custom Objects (new container `mpw-intake`).
- Operations: the API client must be granted `manage_intake_agent` and, for what Intake creates, the cart, shopping list and quote request scopes (shopping lists are not in the current scope list).
- Risk: Intake is synchronous and can be slow; see design for the hosting decision.
