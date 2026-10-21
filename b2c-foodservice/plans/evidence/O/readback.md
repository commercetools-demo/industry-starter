# Read-back (mock catalogue, not the live project)

The live project could not be read (no credentials in this environment; `seed/.env` untouched). Values below come from the
mock server, which serves `seed/src/data` through `scripts/mock-fixtures`:

- USD free-shipping tier 7500, CAD 9900: promise row `$75.00` (US) and `$99.00` (CA) equal them.
- Store channel `Malva Coffee Williamsburg`: `collectionMinutes` 30, shown by the banner.
- Bestsellers: Ember Ristretto, Nocturne Double Espresso, Brazil Santos, Malva House Blend. New: Lungo Sunrise, Vanilla Cloud,
  Ethiopia Yirgacheffe, Pod Plus Milk. Categories `mcf-cat-pods`, `-coffee`, `-machines`, `-accessories`, no images in the fixtures.

Owner action `OA-O-1`: repeat this against the live project once the seed is loaded (home page against real data).
