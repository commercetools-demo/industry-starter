# Create a substitution proposal (testers and staff)

A substitution proposal is an **Order Edit** of custom type `substitution-proposal` on an existing order. The storefront (`/account/orders/<id>`) lists it with Accept / Decline. Merchant Center has no screen that creates an Order Edit with a custom type, so proposals are created through the API (D-032, OA-07). This recipe has two ways: the script (needs `site/.env.seed`) and plain HTTP (Postman or curl). No secrets are written here: use your own API client with the scopes `manage_orders` and `view_types`.

Placeholders: `{projectKey}` = `spec-test-b2c`, `{api}` = `https://api.us-central1.gcp.commercetools.com`, `{token}` = a bearer token from your own client, `{orderId}` = the order id (copy it from the URL of the order detail page).

## Prerequisites
- The order has **inventory mode `None`** (every storefront order does, D-031) and is not shipped, delivered, completed or cancelled. Otherwise the storefront shows the proposal read-only with a "Contact us" link (this is the way to test "Order already shipped").
- The custom type `substitution-proposal` exists (`npm run seed:verify` checks it).
- Know the line item id to replace (`lineItems[].id` of `GET {api}/{projectKey}/orders/{orderId}`) and the SKU of the substitute (seeded substitutes: Whole milk -> `OAT-DRINK-1EACH`, Bananas -> `GALA-APPLES-500G`, see the `substituteProducts` attribute).

## Way 1: script (QA order included)
From `site/` with `.env.seed` present:

```
npx tsx scripts/seed/create-qa-substitution.ts                      # new QA customer + order + proposal on the whole-milk line
npx tsx scripts/seed/create-qa-substitution.ts --order <orderId>    # proposal on an existing order
    [--line-sku WHOLE-MILK-1EACH] [--substitute-sku OAT-DRINK-1EACH] [--note "text"]
```
It prints the QA email, the fixed throwaway password, the order id and the edit id. Sign in with that email and open `/account/orders/<orderId>`. `npx tsx scripts/seed/cleanup-qa.ts` removes the QA customers, orders, carts and their edits. The script never applies the edit.

## Way 2: HTTP
`POST {api}/{projectKey}/orders/edits` with `Authorization: Bearer {token}` and `Content-Type: application/json`:

```json
{
  "resource": { "typeId": "order", "id": "{orderId}" },
  "stagedActions": [
    { "action": "removeLineItem", "lineItemId": "{lineItemId}" },
    {
      "action": "addLineItem",
      "sku": "OAT-DRINK-1EACH",
      "quantity": 1,
      "custom": {
        "type": { "typeId": "type", "key": "line-substitution" },
        "fields": { "substitutionPreference": "none" }
      }
    }
  ],
  "comment": "Substitution proposal",
  "custom": {
    "type": { "typeId": "type", "key": "substitution-proposal" },
    "fields": {
      "originalLineItemId": "{lineItemId}",
      "substituteSku": "OAT-DRINK-1EACH",
      "status": "pending",
      "note": "Whole milk is out of stock today."
    }
  }
}
```
- `quantity` of the added line = quantity of the removed line.
- Do **not** send `dryRun: true`; do **not** call `/apply`: the customer applies it.
- `status` must be exactly `pending`. `originalLineItemId` and `substituteSku` are required by the storefront (an edit without them is ignored as "not a proposal").
- Response: `201` with the edit (`id`, `version`, `result.type = "NotProcessed"`).

## Check it
- `GET {api}/{projectKey}/orders/edits/{editId}` returns `result.type = "PreviewSuccess"` and `result.preview` (the order as it would be) while the order is unchanged. `PreviewFailure` means the staged actions cannot be applied (wrong SKU, no price for the order's market, ...): the storefront then shows the proposal read-only.
- The order detail page shows: "We couldn't find <original>. Proposed: <substitute> (+$x.xx)" with the new total and Accept / Decline.

## What the buttons do (for the Merchant Center check)
- **Accept**: the storefront applies the edit with `editVersion` and `resourceVersion`; in Merchant Center (Orders > the order > Edits, or `GET /orders/edits/{editId}`) the edit shows `result.type = "Applied"` and the order has the substitute line instead of the original. Afterwards `custom.fields.status` is `applied`.
- **Decline**: `custom.fields.status` becomes `declined`; the edit stays **unapplied** (`result.type` is still `NotProcessed`); the order is unchanged and the line shows "Removal requested". Staff then remove the line on the order themselves.
- **Stale**: change the order after creating the proposal (for example `POST /orders/{id}` with `setCustomField`... or any other update that raises the order version) and press Accept in a page that was opened before: apply answers 409 and the page explains and refreshes. A new proposal is needed afterwards if the old one no longer applies.

## Troubleshooting
- 400 "inventoryMode": the order was not created with `None`; Order Edits do not work on it.
- Edit not listed in the storefront: not `status = "pending"`, wrong `resource.id`, already applied, or the order belongs to another customer than the signed-in one.
- Prices: editing re-applies the **current** prices to every line (commercetools behaviour), so the price difference can include changes on lines you did not touch.
