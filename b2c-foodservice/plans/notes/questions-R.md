<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream R (in-store companion)

Draft for the lead to consolidate into `QUESTIONS.md`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-R-1 | The owner wrote "custom-object" for the order type. A commercetools **Custom Object** is a free-standing key/value record that cannot be attached to a cart or an order. Is "custom type fields on the cart" what is meant? | Yes: read as the cart's custom type fields, `custom: { type: { typeId: 'type', key: 'instore-order-type' }, fields: { orderType: 'in-store-purchase' } }`, on a Type (not a Custom Object). The same Type also applies to orders. No Custom Object is created or read. | no | Open |
| Q-R-2 | Items are bought in the store; what fulfilment does a line have in this mode? | `delivery` on every line (the cart engine and the hosted Checkout need a shipping address and method). Collection and subscriptions are not offered. If staff hand the goods over at the till, the answer changes the Checkout configuration (no address, a zero-rate method) and needs a decision. | no | Open |
| Q-R-3 | Which library decodes barcodes where `BarcodeDetector` is missing (Safari, Firefox, desktop Chrome)? | `@zxing/browser` 0.2.1 with `@zxing/library` 0.23.0, both pinned, loaded lazily. Maintained (releases April and July 2026), MIT. Alternative if wasm is acceptable: `barcode-detector` 3.x (needs a self-hosted wasm file or a CDN origin in the CSP). | no | Open |
| Q-R-4 | Should the website also allow the camera (`camera=(self)`) or only the in-store deploy? | Only the in-store deploy (least privilege); the website sends `camera=()`. | no | Open |
| Q-R-5 | What does "availability" mean on a phone in a store? | The online (warehouse) stock, which is what the bag checks. A per-store figure needs a store choice (an extra step). Parked in `IDEAS.md`. | no | Open |
| Q-R-6 | Does the platform copy `Cart.custom` to the `Order` created by the hosted Checkout? | The documentation read (commercetools-knowledge) does not say. Built to be safe either way: a post-order hook sets the field on an order that lacks it. M-R-03 verifies on a real purchase. | live check | Open |
| Q-R-7 | The barcodes on products are the SKUs, for example `MCF-POD-EMBER-50`. Which symbology (Code 128, QR)? | Any: `BarcodeDetector` and zxing read Code 128, Code 39, EAN, UPC, ITF, QR and Data Matrix. Code 128 is recommended for a text SKU. M-R-02 prints samples. | no | Open |
| Q-R-8 | Is a shopper sign-in offered in this mode? | No. The bag is anonymous (a guest checks out with an email in the hosted flow). The demo accounts and the account area are not shown. | no | Open |
| Q-R-9 | The `instore` branch must differ from `main` only by environment, so which branch does the owner deploy? | Merge `instore` to `main` is not planned: the branch deploy builds the same code as `main` with `APP_MODE=instore` set for the `instore` branch. Keep `instore` rebased on `main`. | OA-R-b | Open |
