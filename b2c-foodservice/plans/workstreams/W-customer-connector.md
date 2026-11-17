<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream W: Customer connector (Connect service)

Read `plans/JUNIOR-GUIDE.md` first. Everything runs in the new folder `b2c-foodservice/connect/`, except W-01, which changes the custom type in the project through the commercetools MCP. Plan written on branch `worktree-foodservice-customer-connector-plan` (worktree `.claude/worktrees/foodservice-customer-connector-plan`, not pushed); implement on the same branch. Nothing is deployed by this workstream.

## 1. Header

| Field | Value |
| --- | --- |
| ID | W |
| Name | Customer connector: one commercetools Connect `service` application with CORS `*` that lets a frontend read a customer's orders, carts, wishlists and loyalty points, and read, add, edit and delete the customer's notes |
| Depends on | none (it reads platform data only; it shares no code with `storefront/` or `seed/`) |
| Wave | 16 (independent of the storefront; not part of the release gate of Q) |
| Specs implemented | none: no OpenSpec spec covers this. The endpoint list in section 3 is the contract (owner request, 2026-11-17). |
| Owner prerequisites | OA-W-a (an API client for local live runs), OA-W-b (a separate Git repository for the connector), OA-W-c (deploy as a sandbox), OA-W-d (run `connect validate` with Docker). W-01 needs the MCP `ct-spec-test-b2c-food` connected (it is defined in `industry-starter/.mcp.json`). |
| Skills | `commercetools-connect` (service app, connect.yaml, scopes, tests), `commercetools-platform` (SDK client, query predicates, custom fields) |

## 2. Goal and scope

**Goal.** A frontend (an in-store or storefront app) calls one URL, `https://<connect-host>/customers/{customerId}/...`, from the browser. It gets the customer's orders, carts, wishlists and loyalty points, and keeps a small list of free-text notes about the customer. Notes and loyalty points live as custom fields on the existing InStore type `instore-customer-type`.

**In scope**

1. Two new optional fields on `instore-customer-type`, added through the MCP (W-01): `notes` (Set of String) and `loyaltyPoints` (Number). Nothing else on the type changes.
2. A Connect connector root at `b2c-foodservice/connect/`: `connect.yaml` plus one TypeScript `service` app, scaffolded with the Connect CLI (W-02).
3. Eight GET routes, one POST, one PUT and one DELETE (section 3, D3), CORS `*` (D4), no authentication (D-062).
4. Tests at the router level, a README, and a live run on a local machine against the project (W-13).

**Out of scope**

- Authentication or authorisation of the caller. The owner chose "no auth, demo only" (D-062). The README says plainly that anyone who knows a customer id can read that customer's orders and edit their notes.
- Writing `loyaltyPoints`. It is set only through the commercetools API or Merchant Center, never through this service.
- Any change to `storefront/` (no page calls the service in this workstream) or to the seed.
- Deploying. The connector cannot be deployed from this repository as it stands (D-064); OA-W-b and OA-W-c cover that.

## 3. Design

### D1. Where it lives (D-064)

Connect clones a Git repository and reads `connect.yaml` **at the repository root** only (Connect docs: `ConnectorStagedDraft.repository` is a URL and a tag, no sub-path). The Git root here is `industry-starter`, which holds five other industries, so `connect.yaml` must not go there. Instead:

```
b2c-foodservice/connect/          # connector root (becomes the root of its own repository, OA-W-b)
├── connect.yaml
├── README.md
└── customer-api/                 # the service app; folder name == deployAs[].name
    ├── package.json  tsconfig.json  jest or vitest config (whatever the CLI template generates)
    ├── src/  (index.ts, app.ts, routes/, controllers/, client/, middleware/, validators/, utils/)
    └── tests/
```

For deployment the owner mirrors `b2c-foodservice/connect/` into its own repository (`git subtree split --prefix b2c-foodservice/connect`), tags it and registers it (OA-W-b). No npm workspaces; the app folder is self-contained.

### D2. connect.yaml

```yaml
deployAs:
  - name: customer-api
    applicationType: service
    endpoint: /customers
    configuration:
      standardConfiguration:
        - key: CORS_ALLOWED_ORIGIN
          description: Value of Access-Control-Allow-Origin. Default "*" (D4).
          required: false
          default: '*'
inheritAs:
  apiClient:
    scopes:
      - view_orders            # orders and carts (read)
      - view_shopping_lists    # wishlists (read)
      - manage_customers       # read the customer, write the notes field
      - view_types             # resolve the custom type key (expand custom.type)
```

- The platform generates the API client from `inheritAs.apiClient.scopes` and injects `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPE`, `CTP_PROJECT_KEY`, `CTP_API_URL` and `CTP_AUTH_URL`. They are **not** declared under `configuration`.
- Scope names come from the Scopes reference (`view_orders` covers Carts and Orders; `view_shopping_lists` covers Shopping Lists). Never `manage_project`.
- `view_types` is included so the service can read the key of the customer's custom type (`expand=custom.type`). Q-W-6 is settled by including it; W-13 can try without it with the OA-W-a client.
- No `scripts` block: the service registers no Extension or Subscription, and the type change is done once through the MCP (W-01), not by `postDeploy`.
- Route mount = endpoint: `app.use('/customers', router)`. The deployed paths are therefore exactly the owner's: `{connect-url}/customers/{customerId}/orders` and so on.

### D3. Routes (the contract)

Every route first checks `customerId` is a UUID (400 `invalid_customer_id` otherwise) and that the customer exists (404 `customer_not_found`). Errors are JSON `{ "error": "<code>", "message": "<text>" }`; no stack traces outside development.

| Method and path | Reads or writes | Answer |
| --- | --- | --- |
| `GET /customers/{customerId}/orders` | `orders` where `customerId = :cid`, sort `createdAt desc`, `limit` (default 20, max 100) and `offset` query parameters | commercetools paged response `{ limit, offset, count, total, results }` with the Order objects as returned by the API |
| `GET /customers/{customerId}/orders/{id}` | order by id | the Order, or 404 `not_found` when it does not exist **or** its `customerId` is not `{customerId}` |
| `GET /customers/{customerId}/carts` | `carts` where `customerId = :cid`, same paging, optional `cartState` filter (`Active`, `Merged`, `Ordered`, `Frozen`) | paged response |
| `GET /customers/{customerId}/carts/{id}` | cart by id | the Cart, or 404 as for orders |
| `GET /customers/{customerId}/wishlists` | `shopping-lists` where `customer(id = :cid)`, same paging | paged response |
| `GET /customers/{customerId}/wishlists/{id}` | shopping list by id | the ShoppingList, or 404 when `customer.id` is not `{customerId}` |
| `GET /customers/{customerId}/notes` | the customer | `{ "notes": [{ "index": 0, "text": "..." }, ...] }`, sorted (D5); `[]` when the field is absent |
| `POST /customers/{customerId}/notes` | body `{ "text": "..." }` | 201 with the new notes list |
| `PUT /customers/{customerId}/notes/{index}` | body `{ "text": "new", "expected": "old" }` (`expected` optional) | 200 with the new notes list |
| `DELETE /customers/{customerId}/notes/{index}` | body `{ "expected": "old" }` (optional) | 200 with the new notes list |
| `GET /customers/{customerId}/loyaltyPoints` | the customer | `{ "customerId": "...", "loyaltyPoints": 0 }`; `0` when the field is absent (Q-W-3) |
| `GET /customers/health` | nothing | 200 `{ "status": "ok" }`, registered before the `{customerId}` routes |

Any other method on a known path answers 405 with an `Allow` header (for example `POST /customers/{customerId}/loyaltyPoints`).

**Predicates use input variables, never string building.** `where=customerId = :cid` with `var.cid=<id>` (and `customer(id = :cid)` for shopping lists). With no authentication, the path value is attacker-controlled; the UUID check plus input variables keep it out of the predicate syntax.

### D4. CORS

The `cors` middleware with `origin: '*'` (from `CORS_ALLOWED_ORIGIN`), methods `GET, POST, PUT, DELETE, OPTIONS`, allowed header `Content-Type`, no credentials, `maxAge` 600. Preflight `OPTIONS` answers 204 for every route. Because there are no credentials, `*` is a valid origin value for browsers.

### D5. Notes are a Set: order is not fixed (Q-W-1)

The Custom Fields reference says a Set field holds a "JSON array without duplicates" and "The order of items in the array is not fixed". An `{index}` taken straight from the stored array is therefore not stable between two calls. The default being built:

- The service always presents notes **sorted** (`localeCompare` with `en`, then code-point order as a tie-break). `index` is the position in that sorted list. The same contents always give the same indexes, whatever order the API returns them in.
- PUT and DELETE re-read the customer, sort, and take the note at `index`. If the body has `expected` and it differs from that note, the answer is 409 `note_changed` and nothing is written. The frontend should always send `expected`; the README says so.
- A note's text is trimmed, 1 to 1000 characters, else 400 `invalid_text`. At most 100 notes per customer, else 409 `too_many_notes`.
- Adding or changing a note to a text that is already in the list answers 409 `duplicate_note` (a Set cannot hold it twice).
- An `index` that is not a whole number answers 400 `invalid_index`; one outside the list answers 404 `note_not_found`.

Alternative (Q-W-1 option B): change `notes` to a String field holding a JSON array of `{ id, text, createdAt }`. That gives stable ids and duplicates, but it is not the Set the owner asked for, and a field type cannot be changed later without removing the field.

### D6. Writing notes without losing InStore data

`instore-customer-type` belongs to commercetools InStore and already carries `paymentAccountIds`. `setCustomType` **replaces all custom fields**, so it is used only when the customer has no type at all:

| Customer's `custom` | Update action |
| --- | --- |
| type `instore-customer-type` | `setCustomField` `notes` with the full new array (or with no value when the array becomes empty, so the field is removed) |
| none | `setCustomType` `{ typeId: "type", key: "instore-customer-type" }` with `fields: { notes: [...] }` |
| another type | 409 `foreign_custom_type`, nothing written |

Every write sends the customer `version`. On 409 `ConcurrentModification` the service re-reads the customer, re-applies the change and tries again, at most 3 times, then answers 409 `conflict`.

### D7. Client, configuration, logs

- `@commercetools/platform-sdk@^8` and `@commercetools/ts-client@^4`; `apiRoot` built once at start-up.
- `readConfiguration()` validates every environment variable once at start-up and throws on a missing one.
- One JSON log line per request: method, route pattern (not the raw path), status, duration, `X-Correlation-ID` (generated when absent and echoed back). No request bodies or note texts in the logs (they may hold personal data).

## 4. Tasks

Common rules: test first; `npm run check` (or the template's `build` plus `test`) in `connect/customer-api` before ticking; commit `connect: W-nn summary`.

- [x] **W-00 Plan and notes.** This file, `STATUS.md` row W, `DEPENDENCY-PLAN.md` row W, D-062 to D-064 in `DECISIONS.md`, `notes/questions-W.md`, `notes/todo-W.md`, rows copied by hand into the generated blocks of `QUESTIONS.md` and `TODO-MANUAL-TESTING.md` (do **not** run `consolidate-notes.mjs` on main: it drops the T rows).
- [x] **W-01 Custom type fields (MCP).** With the MCP `ct-spec-test-b2c-food`: `read_types` key `instore-customer-type` (version 1 and one field `paymentAccountIds` on 2026-11-17), then `update_types` with that version and two `addFieldDefinition` actions: `notes` (`Set` of `String`, `required: false`, `inputHint: MultiLine`, label "Notes" in en-AU, en-GB, en-IE, en-US) and `loyaltyPoints` (`Number`, `required: false`, label "Loyalty points" in the same four locales). Read the type back and save it to `plans/evidence/W/type-after.json`. Probe on one seeded demo customer: set three notes, read them back twice and record the order (D5), add a duplicate (expect an error) and record it, then remove the notes. Nothing else on the type changes.
- [x] **W-02 Scaffold.** `commercetools connect init connect` was tried (start from scratch, TypeScript, Service, name `customer-api`, endpoint `/customers`, variable `CORS_ALLOWED_ORIGIN`). On 2026-11-17 it answered every prompt, then exited 0 at "Initializing your Connect project" and wrote nothing (CLI 0.0.25, Node 22.21.1). The folder was therefore built by hand on the structure of the sibling labs connector `tiktok/service` (npm, ts-jest, supertest) and `connect.yaml` follows the docs example. SDK versions pinned (D7). `commercetools connect validate` needs a running Docker daemon and could not run here: it is an owner row (OA-W-d).
- [x] **W-03 connect.yaml and configuration.** D2 as written; `readConfiguration()` and its tests (missing variable throws; `CORS_ALLOWED_ORIGIN` defaults to `*`).
- [x] **W-04 App shell.** Mount at `/customers`, `health` route, CORS (D4), JSON error middleware, 405 handler, correlation id and request log (D7). Tests: `health answers 200`, `preflight OPTIONS for PUT and DELETE answers 204 with Access-Control-Allow-Origin *`, `unknown method answers 405 with Allow`, `errors hide the stack outside development`.
- [x] **W-05 Customer guard.** UUID check and customer existence lookup shared by every route. Tests: `non-UUID customerId answers 400`, `unknown customer answers 404`.
- [x] **W-06 Orders.** List and by id (D3). Tests: `list uses an input variable, not string building`, `limit is capped at 100`, `order of another customer answers 404`.
- [x] **W-07 Carts.** As W-06 plus the `cartState` filter. Tests: `cartState filter`, `invalid cartState answers 400`, `cart of another customer answers 404`.
- [x] **W-08 Wishlists.** As W-06 with `customer(id = :cid)`. Tests: `wishlist of another customer answers 404`, `list paging`.
- [x] **W-09 Notes read and sort.** Pure functions `presentNotes(raw)` and `noteAt(list, index)` (D5), and the GET route. Tests: `same contents in any order give the same indexes`, `absent field gives []`, `index not a whole number answers 400`, `index out of range answers 404`.
- [x] **W-10 Notes add.** POST (D5, D6). Tests: `customer with the type gets setCustomField only`, `customer without a type gets setCustomType with notes`, `customer with another type answers 409 and is not written`, `paymentAccountIds is never in the actions`, `duplicate text answers 409`, `text over 1000 characters answers 400`, `101st note answers 409`.
- [x] **W-11 Notes edit and delete.** PUT and DELETE (D5, D6). Tests: `expected mismatch answers 409 and writes nothing`, `edit to an existing text answers 409`, `deleting the last note removes the field`, `ConcurrentModification is retried and then succeeds`, `three conflicts answer 409 conflict`.
- [x] **W-12 Loyalty points.** GET only. Tests: `absent field answers 0`, `value is returned as a number`, `POST, PUT and DELETE answer 405`.
- [ ] **W-13 README and live run.** `connect/README.md`: the "no auth, demo only" warning first, the route table, the scopes and why, the configuration table, notes semantics (D5), fail behaviour (the service only proxies commercetools; when commercetools is down it answers 502 and the frontend shows an error), and the deploy steps of OA-W-b and OA-W-c. Then, with the OA-W-a client in `connect/customer-api/.env` (gitignored), `npm run start:dev` and the recipe of section 6 against the project. Evidence in `plans/evidence/W/`. **Live run not done: blocked on OA-W-a** (README is written).

## 5. Scenarios checklist

No spec scenarios apply (no spec is owned). The behaviours below are the acceptance list; each names its test or evidence.

- [ ] Every route is under `/customers` and matches `endpoint`: `app.test.ts` `health answers 200`.
- [ ] Browsers may call it from any origin: `app.test.ts` `preflight OPTIONS for PUT and DELETE answers 204 with Access-Control-Allow-Origin *`.
- [ ] A bad or unknown customer id never reaches a query: `customer-guard.test.ts` `non-UUID customerId answers 400`, `unknown customer answers 404`.
- [ ] One customer cannot read another's order, cart or wishlist through the path: `orders.test.ts` `order of another customer answers 404`, `carts.test.ts` `cart of another customer answers 404`, `wishlists.test.ts` `wishlist of another customer answers 404`.
- [ ] Note indexes are stable although the Set has no fixed order: `notes.test.ts` `same contents in any order give the same indexes`.
- [ ] Adding a note never wipes InStore fields: `notes-write.test.ts` `paymentAccountIds is never in the actions`.
- [ ] A stale edit is refused: `notes-write.test.ts` `expected mismatch answers 409 and writes nothing`.
- [ ] Concurrent writes are retried: `notes-write.test.ts` `ConcurrentModification is retried and then succeeds`.
- [ ] Loyalty points are read only: `loyalty.test.ts` `POST, PUT and DELETE answer 405`.
- [ ] The type has both fields in the project: `plans/evidence/W/type-after.json`.

## 6. Browser recipe (Chrome DevTools MCP)

The service has no pages; the browser part proves CORS from a real page. With the service running locally on port 8080 (W-13):

1. Serve a one-line page from another port so the call is cross-origin: `mkdir -p /tmp/w-probe && echo '<p>W probe</p>' > /tmp/w-probe/index.html && npx http-server /tmp/w-probe -p 5050`. Open `http://localhost:5050` in the in-app browser (a public `https` page is not used: Chrome may block calls from it to `localhost` for reasons that are not CORS). In the console run `fetch('http://localhost:8080/customers/<demo customer id>/orders').then(r => r.json())`: it resolves, no CORS error.
2. Same page: `fetch(.../notes, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'W probe' }) })`, then PUT index 0 with `expected`, then DELETE with `expected`. The network panel shows a 204 preflight before each write.
3. `fetch(.../loyaltyPoints, { method: 'POST' })` answers 405.
4. Read the customer through the MCP (`read_customers`): `notes` is gone again and `paymentAccountIds` is unchanged.
5. Console clean apart from the expected 405. Save the network list to `plans/evidence/W/cors.md`.

## 7. Self-verification with data (no asking the owner)

- Unit and router tests replace the commercetools layer (`CtApi`) with an in-memory fake (`tests/fake-api.ts`, built instead of `msw`), so they run with no credentials.
- W-01 and the recipe use the MCP `ct-spec-test-b2c-food` to read and write the project. Live writes touch only one seeded demo customer's `notes`, and each run removes what it added.
- Without OA-W-a the live part of W-13 is blocked; everything else is done and the STATUS row says `Blocked: OA-W-a` for the live run only.

## 8. Manual testing and owner items (also in `plans/notes/todo-W.md`)

See `plans/notes/todo-W.md`: OA-W-a (API client for local runs), OA-W-b (separate repository and ConnectorStaged), OA-W-c (sandbox deployment), M-W-01 (a frontend calls the deployed URL).

## 9. Questions (also in `plans/notes/questions-W.md`)

See `plans/notes/questions-W.md` (Q-W-1 to Q-W-6). Each has the default that is built.

## 10. Definition of done

- W-00 to W-13 ticked, each with a passing check commit in `connect/customer-api`.
- `commercetools connect validate` passes; `commercetools connect application test` passes.
- Acceptance list in section 5 has a named passing test or recorded evidence.
- The type read-back shows `notes` and `loyaltyPoints` and an unchanged `paymentAccountIds`.
- The README opens with the "no auth, demo only" warning.
- Owner rows exist; no deploy, no push; `node plans/verify-plan.mjs --strict` adds no new error for W.
