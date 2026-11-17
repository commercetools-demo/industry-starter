<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Malva Coffee customer connector

A commercetools Connect `service` application. A frontend calls it from the browser to read a customer's orders, carts, wishlists and loyalty points, and to read, add, edit and delete the customer's notes.

> **No authentication. Demo only.** Every route takes the customer id from the URL and answers anyone who calls it, and CORS allows every origin. Anyone who knows or guesses a customer id can read that customer's orders, carts and wishlists and change their notes. Deploy it only to a throwaway demo project, never to one with real customer data. (Decision D-062.)

## Routes

Deployed URL: `{connect-url}/{endpoint}`, and the endpoint is `/customers`. The URL Connect reports already ends in `/customers`, so a route below is that URL plus the part after `/customers`. Locally the service listens on `http://localhost:8080` and the paths are exactly as written.

| Method and path | What it does |
| --- | --- |
| `GET /customers/{customerId}/orders` | The customer's orders, newest first. Query: `limit` (default 20, max 100), `offset`. |
| `GET /customers/{customerId}/orders/{id}` | One order. 404 if it does not exist or belongs to another customer. |
| `GET /customers/{customerId}/carts` | The customer's carts, newest first. Query: `limit`, `offset`, `cartState` (`Active`, `Merged`, `Ordered`, `Frozen`). |
| `GET /customers/{customerId}/carts/{id}` | One cart. 404 as for orders. |
| `GET /customers/{customerId}/wishlists` | The customer's shopping lists. Query: `limit`, `offset`. |
| `GET /customers/{customerId}/wishlists/{id}` | One shopping list. 404 as for orders. |
| `GET /customers/{customerId}/notes` | `{ "notes": [{ "index": 0, "text": "..." }] }` |
| `POST /customers/{customerId}/notes` | Body `{ "text": "..." }`. 201 with the new list. |
| `PUT /customers/{customerId}/notes/{index}` | Body `{ "text": "new", "expected": "old" }`. 200 with the new list. |
| `DELETE /customers/{customerId}/notes/{index}` | Body `{ "expected": "old" }`, or `?expected=old`. 200 with the new list. |
| `GET /customers/{customerId}/loyaltyPoints` | `{ "customerId": "...", "loyaltyPoints": 0 }`. Read only: any other method answers 405. |
| `GET /customers/health` | `{ "status": "ok" }` |

List answers are commercetools paged responses (`limit`, `offset`, `count`, `total`, `results`). Errors are `{ "error": "<code>", "message": "..." }`. Other methods on a known path answer 405 with an `Allow` header.

### Notes: read this before building a frontend

`notes` is a Set of String custom field on the customer type `instore-customer-type`. commercetools says a Set's order is **not fixed** and it holds **no duplicates**. So:

- Notes are always shown **sorted**; `index` is the position in that sorted list.
- **Always send `expected`** (the text you believe is at that index) with PUT and DELETE. If someone else changed the list, the service answers 409 `note_changed` and writes nothing, instead of editing the wrong note.
- Adding or editing to a text that already exists answers 409 `duplicate_note`.
- Text is trimmed, 1 to 1000 characters. At most 100 notes per customer.
- Deleting the last note removes the field. A customer with no notes returns `[]`.
- Writes use `setCustomField`. Only a customer with **no** custom type gets `setCustomType`, because `setCustomType` replaces every field and would wipe InStore's `paymentAccountIds`. A customer with a different custom type answers 409 `foreign_custom_type`.
- A write that loses a race with another writer is retried from a fresh read, up to 3 times, then answers 409 `conflict`.

`loyaltyPoints` is a Number custom field on the same type. It is changed only through the commercetools API or Merchant Center.

## commercetools data

The type `instore-customer-type` (resource type `customer`, owned by commercetools InStore) has these fields. `notes` and `loyaltyPoints` were added on 2026-11-17; `paymentAccountIds` is InStore's and is never touched.

| Field | Type |
| --- | --- |
| `paymentAccountIds` | Set of String |
| `notes` | Set of String |
| `loyaltyPoints` | Number |

## Configuration

| Key | Where | Required | Meaning |
| --- | --- | --- | --- |
| `CORS_ALLOWED_ORIGIN` | `connect.yaml` standardConfiguration | No, default `*` | Value of `Access-Control-Allow-Origin`. |
| `CTP_PROJECT_KEY`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPE`, `CTP_AUTH_URL`, `CTP_API_URL` | Injected by Connect from `inheritAs.apiClient` | Yes | Do not declare them. For local runs, copy `customer-api/.env.example` to `customer-api/.env`. |

### Scopes (least privilege)

| Scope | Why |
| --- | --- |
| `view_orders` | Read orders and carts. |
| `view_shopping_lists` | Read wishlists. |
| `manage_customers` | Read the customer; write the `notes` field. |
| `view_types` | Resolve the key of the customer's custom type (`expand=custom.type`). |

Never `manage_project`.

## When commercetools is down

The service only proxies commercetools and keeps no state. If commercetools fails, the service answers 502 `upstream_error` with a generic message; the frontend should show an error and may retry. Nothing is cached.

## Logs

One JSON line per request: method, route pattern, status, duration and `X-Correlation-ID` (sent by the caller or generated, and echoed in the response). Request bodies and note texts are never logged.

## Develop and test

```bash
cd customer-api
npm install
npm run check     # typecheck and tests
npm run build
npm run start:dev # needs customer-api/.env
```

Tests mock the commercetools layer with an in-memory fake, so they need no credentials.

## Deploy

`connect.yaml` is in the parent folder, `b2c-foodservice/`. Connect reads `connect.yaml` only at a repository root, so `b2c-foodservice/` must be the **root of its own Git repository**. From the monorepo root:

```bash
git subtree split --prefix b2c-foodservice -b connect-export
```

Push `connect-export` to a new repository as `main`, tag it (for example `v0.1.0`), register it as a Connector (Merchant Center, or `commercetools connect connectorstaged create`) and deploy it to a **sandbox** deployment in the same region as the project. See `plans/TODO-MANUAL-TESTING.md` rows OA-W-b and OA-W-c.
