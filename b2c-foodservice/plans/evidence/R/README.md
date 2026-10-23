# Evidence for workstream R (In-store companion)

Screenshots taken in Chrome with device emulation against the mock server (`storefront/scripts/mock-ct-server.mjs`).

| File | Shows |
| --- | --- |
| R08-home-375.png | home: badge, camera, scan button, category tiles (375x812) |
| R09-category-375.png | category list rows |
| R09-product-added-375.png | product page after Add to bag |
| R10-scan-result-added-375.png | scan result dialog after adding |
| R10-camera-denied-low-stock-375.png | camera denied with manual entry; low stock result |
| R11-bag-375.png | bag with sticky total and Checkout |
| R11-checkout-375.png | single-column checkout review |
| R14-home-360x640.png | home at 360x640, no horizontal overflow |

Lighthouse mobile (dev server, mock data): accessibility 100 on category, product and bag; home 96 before two fixes (hint text contrast, link name), fixed afterwards. SEO shows "blocked from indexing" by design (noindex).
