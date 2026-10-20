## Context

The storefront (`site/`, Next.js on Netlify) is a BFF: the browser never holds commercetools credentials; `lib/ct/client.ts` holds the one SDK client; per-Business-Unit demo data lives in Custom Objects (`lib/ct/portal-data.ts`). Intake is a single synchronous, stateless POST (`/{projectKey}/agents/intake/v1/responses`) with no get/list/delete and no status, no SDK support, scope `manage_intake_agent:{projectKey}`, max 3 files of 20 MB, JSON or multipart (`payload` + `files`). It resolves the customer, Business Unit and store from the input, so identity must be written into the prompt.

## Goals / Non-Goals

**Goals:** submit files/text for Cart, Shopping list or Quote request; durable "recent intakes" list with In progress -> Done/Failed; entity reference kept per record; signed-in-only entry.
**Non-Goals:** row actions; ownership verification of the created entity; multi-turn; Intake read/list/delete (do not exist); any use of the SDK for Intake.

## Decisions

### D1. Where the Intake call runs (the owner's timeout question)

| Option | Works? | Trade-offs |
|---|---|---|
| (a) Browser calls Intake directly with a token minted by the BFF | Unverified: depends on commercetools CORS for this host | The only token the BFF can mint is a client-credentials token, which cannot be limited by lifetime per user and is not bound to a customer. Intake resolves customer/BU from the prompt, so a holder could create carts for any customer. Rejected on security grounds regardless of CORS. |
| (c) Browser calls Intake, then reports the result to the BFF | Same token exposure as (a), plus a client-reported result that cannot be trusted | Rejected. |
| (b) Next route handler calls Intake server-side | Yes | Needs a host function, so "no Netlify functions" is not achievable for any BFF path; the site already runs its API routes there. Duration limit is the risk. |

**Decision: (b), decoupled from the browser request.** `POST /api/intake` validates, writes the `processing` record, answers 202 `{ id }` immediately, and runs the Intake call in the background of that invocation using Next's `after()` (or the Netlify equivalent). The browser never waits on Intake, so the redirect to the list is instant and a slow Intake only lengthens the background work. The hard ceiling is the host's function duration for that invocation, which cannot be known from here: task 1 is a spike measuring a real Intake call and the platform limit. If it exceeds the limit, the fallback is a Netlify background function for this one route (documented, still server-side); (a)/(c) stay rejected.

### D2. Records as Custom Objects

Container `mpw-intake`, key `<businessUnitKey>.<recordId>` (same prefix-range read as `fetchRecords`, newest 50, sorted by `createdAt`). Record value: `id, status (processing|done|failed), outputType, listName?, fileNames[], customerId, createdAt, completedAt?, entity? {type, id, cartId?}, warnings[], errorCode?`. No file content or prompt text is stored (may contain personal data); only names and sizes. Written through the SDK `apiRoot`; scope `manage_key_value_documents` is already granted. Updates use the Custom Object's `version` (optimistic concurrency) and only move `processing` -> terminal.

### D3. Raw HTTP client

`lib/ct/intake.ts` gets a token the same way the SDK client does (client credentials against `CTP_AUTH_URL`, token cached with expiry), then `fetch`es `CTP_API_URL/{projectKey}/agents/intake/v1/responses`. Multipart is built with `FormData`: `payload` as a `Blob` of type `application/json`, each file under the name `files`. Responses are parsed by a zod schema loosely (the success body field names beyond `id`, `cartId`, `entityType`, `warnings` are not documented, so only those are read). Errors map to `{code, message}` from `errors[0]`; raw bodies are never returned to the browser.

### D4. Prompt construction

Server-built: `Customer email: <session email>. Business unit key: <session BU>. [Shopping list name: "<name>".] <free text>`. Cart and Quote request also need a shipping country; it is the session country (the same one a cart is created with).

### D5. In-progress and stale

The list is a client component using the existing SWR setup, polling `GET /api/intake` every few seconds while any row is `processing`. A `processing` record older than `INTAKE_STALE_MS` (default 10 minutes, to be tuned with the D1 spike) is returned as `failed/StaleProcessing` by the read path (the stored record is left untouched).

### D6. UI placement

`IntakeButton` mirrors `PortalButton` (`useAccount()`, renders nothing when signed out, no signed-in flash because it resolves after hydration) in `TopBar` and `MobileMenu`. Page under `account/(portal)/intake`, so the existing layout provides sign-in redirect, `noindex` and nav. Route key added to `ROUTES`.

## Risks / Trade-offs

- **Function duration** (D1): mitigated by decoupling and the stale rule; remaining risk is the host limit, measured in the spike.
- **Orphaned work**: a function that dies after Intake created the entity leaves no reference; shown as failed. Accepted for now; reconciling is a follow-up.
- **Ownership** of the created entity is not verified (owner decision); the prompt-injected identity is the only guard.
- **Scopes**: the API client also needs scopes for what Intake creates; shopping lists are not in `FRONTEND_SCOPES` today. The spike confirms the minimum set and `lib/scopes.ts` documents each.
- **Undocumented success body**: kept tolerant; the spike captures a real response for tests.

## Open Questions

- Real host duration limit and whether `after()` is honoured on this Netlify runtime (spike).
- Minimum extra scopes (`manage_shopping_lists`, `view_business_units`, ...) for the API client.
