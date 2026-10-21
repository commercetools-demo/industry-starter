<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed requests

- (I) Optional line field `priceWas` (number, minor units) on type `mcf-line-fulfilment`: lets the cart keep the "Price updated" mark across reloads (Q-I-06, Q-I-19). Not required.
- (I) `savedToLineItem` is not needed: the cart reads variant attributes from one batched projection read (Q-I-07).
- (I) A SKU with a US price but no CAD price (to see the "could not be moved" banner against the live project); the mock server covers it locally.
