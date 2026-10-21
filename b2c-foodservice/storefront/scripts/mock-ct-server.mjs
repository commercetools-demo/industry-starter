// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Local stand-in for the commercetools auth and API hosts, used to drive the storefront in a browser when no live
// credentials exist (workstream F). Fixtures follow plans/SEED-PLAN.md: six NYC stores, the category tree, standard
// shipping with freeAbove 75 USD / 99 CAD, inventory with two stores at zero for one SKU.
//
//   node scripts/mock-ct-server.mjs [port]      (needs openssl; writes a throwaway certificate to the OS temp dir)
//   NODE_TLS_REJECT_UNAUTHORIZED=0 CTP_API_URL=https://localhost:9443 CTP_AUTH_URL=https://localhost:9443 \
//     CTP_PROJECT_KEY=mock-project EXPECTED_PROJECT_KEY=mock-project CTP_CLIENT_ID=mock CTP_CLIENT_SECRET=mock \
//     CTP_SCOPES=view_project_settings:mock-project SESSION_SECRET=<32+ chars> npm run dev
//
// Nothing here is a real credential. Never point it at a real project.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.argv[2] ?? 9443);
const PROJECT = 'mock-project';

const dir = mkdtempSync(join(tmpdir(), 'mock-ct-'));
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=localhost',
  '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
], { stdio: 'ignore' });

const hours = (open, close, sundayClosed = false) =>
  JSON.stringify({
    mon: { open, close }, tue: { open, close }, wed: { open, close }, thu: { open, close },
    fri: { open, close }, sat: { open: '08:00', close }, sun: sundayClosed ? null : { open: '09:00', close: '17:00' },
  });

const STORES = [
  ['mcf-store-nyc-soho', 'Malva SoHo', '123 Prince St', '10012', 40.7243, -73.9977, '07:00', '19:00', false, 10],
  ['mcf-store-nyc-brooklyn', 'Malva Brooklyn', '45 Bedford Ave', '11222', 40.7203, -73.9573, '07:00', '19:00', false, 15],
  ['mcf-store-nyc-upper-west', 'Malva Upper West Side', '2210 Broadway', '10024', 40.7871, -73.9754, '07:00', '18:00', true, 10],
  ['mcf-store-nyc-chelsea', 'Malva Chelsea', '88 Ninth Ave', '10011', 40.7424, -74.0048, '06:30', '19:00', false, 20],
  ['mcf-store-nyc-williamsburg', 'Malva Williamsburg', '210 Wythe Ave', '11249', 40.7178, -73.9625, '07:30', '18:30', false, 15],
  ['mcf-store-nyc-astoria', 'Malva Astoria', '31-02 Broadway', '11106', 40.7614, -73.9242, '07:00', '18:00', true, 25],
].map(([key, name, addressLine, postalCode, lat, lng, open, close, sundayClosed, minutes], i) => ({
  id: `chan-${i + 1}`, version: 1, key, roles: ['InventorySupply'], name: { 'en-US': name, 'en-CA': name },
  address: { country: 'US', city: 'New York', postalCode, streetName: addressLine },
  geoLocation: { type: 'Point', coordinates: [lng, lat] },
  custom: {
    type: { typeId: 'type', id: 'mcf-store-type' },
    fields: { addressLine, city: 'New York', postalCode, phone: '+1 212 555 0100', hours: hours(open, close, sundayClosed), collectionMinutes: minutes },
  },
  createdAt: '2026-01-01T00:00:00.000Z', lastModifiedAt: '2026-01-01T00:00:00.000Z',
}));

const cat = (key, slug, name, parent, orderHint) => ({
  id: `cat-${key}`, version: 1, key, name: { 'en-US': name, 'en-CA': name }, slug: { 'en-US': slug, 'en-CA': slug },
  ...(parent ? { parent: { typeId: 'category', id: `cat-${parent}` } } : {}), orderHint, ancestors: [],
  createdAt: '2026-01-01T00:00:00.000Z', lastModifiedAt: '2026-01-01T00:00:00.000Z',
});
const CATEGORIES = [
  cat('mcf-cat-pods', 'pods', 'Pods', null, '0.1'),
  cat('mcf-cat-pods-original', 'pods-original', 'Original', 'mcf-cat-pods', '0.1'),
  cat('mcf-cat-pods-vertuo', 'pods-vertuo', 'Vertuo', 'mcf-cat-pods', '0.2'),
  cat('mcf-cat-coffee', 'coffee', 'Coffee', null, '0.2'),
  cat('mcf-cat-coffee-beans', 'coffee-beans', 'Beans', 'mcf-cat-coffee', '0.1'),
  cat('mcf-cat-coffee-ground', 'coffee-ground', 'Ground', 'mcf-cat-coffee', '0.2'),
  cat('mcf-cat-coffee-single-origin', 'single-origin', 'Single origin', 'mcf-cat-coffee', '0.3'),
  cat('mcf-cat-coffee-blends', 'blends', 'Blends', 'mcf-cat-coffee', '0.4'),
  cat('mcf-cat-machines', 'machines', 'Machines', null, '0.3'),
  cat('mcf-cat-machines-capsule', 'capsule-machines', 'Capsule', 'mcf-cat-machines', '0.1'),
  cat('mcf-cat-machines-bean-to-cup', 'bean-to-cup', 'Bean-to-cup', 'mcf-cat-machines', '0.2'),
  cat('mcf-cat-machines-espresso', 'espresso-machines', 'Espresso', 'mcf-cat-machines', '0.3'),
  cat('mcf-cat-machines-filter', 'filter-machines', 'Filter', 'mcf-cat-machines', '0.4'),
  cat('mcf-cat-machines-grinders', 'grinders', 'Grinders', 'mcf-cat-machines', '0.5'),
  cat('mcf-cat-accessories', 'accessories', 'Accessories', null, '0.4'),
  cat('mcf-cat-accessories-cups-mugs', 'cups-mugs', 'Cups and mugs', 'mcf-cat-accessories', '0.1'),
  cat('mcf-cat-accessories-frothers', 'frothers', 'Frothers', 'mcf-cat-accessories', '0.2'),
  cat('mcf-cat-accessories-care', 'care', 'Care', 'mcf-cat-accessories', '0.3'),
  cat('mcf-cat-accessories-storage', 'storage', 'Storage', 'mcf-cat-accessories', '0.4'),
  cat('mcf-cat-gifts', 'gifts', 'Gifts', null, '0.5'),
];

const rate = (currency, freeAbove) => ({
  price: { type: 'centPrecision', currencyCode: currency, centAmount: currency === 'USD' ? 695 : 895, fractionDigits: 2 },
  freeAbove: { type: 'centPrecision', currencyCode: currency, centAmount: freeAbove, fractionDigits: 2 },
  isMatching: true,
});

// Inventory: POD-ORIG-10 is in stock online, empty at SoHo and Astoria, low at Brooklyn, plenty elsewhere.
const INVENTORY = {
  'POD-ORIG-10': { online: 120, 'chan-1': 0, 'chan-2': 3, 'chan-3': 40, 'chan-4': 22, 'chan-5': 9, 'chan-6': 0 },
  'MACH-1': { online: 0, 'chan-1': 2 },
};
const inventoryEntries = (sku) => {
  const row = INVENTORY[sku];
  if (!row) return [];
  return Object.entries(row).map(([where, qty]) => ({
    id: `inv-${sku}-${where}`, version: 1, sku, availableQuantity: qty, quantityOnStock: qty,
    ...(where === 'online' ? {} : { supplyChannel: { typeId: 'channel', id: where } }),
  }));
};

const CARTS = { 'cart-active': { cartState: 'Active', totalLineItemQuantity: 3, lineItems: [{ quantity: 2 }, { quantity: 1 }] } };

const list = (results) => ({ limit: 500, offset: 0, count: results.length, total: results.length, results });
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (req, res) => {
  const url = new URL(req.url ?? '/', `https://localhost:${PORT}`);
  const path = url.pathname;
  if (path === '/oauth/token') {
    return json(res, 200, { access_token: 'mock-token', token_type: 'Bearer', expires_in: 172800, scope: `view_project_settings:${PROJECT}` });
  }
  if (path === `/${PROJECT}`) {
    return json(res, 200, { key: PROJECT, version: 1, countries: ['US', 'CA'], currencies: ['USD', 'CAD'], languages: ['en-US', 'en-CA'] });
  }
  if (path === `/${PROJECT}/channels`) return json(res, 200, list(STORES));
  if (path === `/${PROJECT}/categories`) return json(res, 200, list(CATEGORIES));
  if (path === `/${PROJECT}/shipping-methods/matching-location`) {
    const currency = url.searchParams.get('currency') ?? 'USD';
    const freeAbove = currency === 'CAD' ? 9900 : 7500;
    return json(res, 200, list([
      { id: 'ship-std', version: 1, key: 'mcf-ship-standard', name: 'Standard', zoneRates: [{ zone: { typeId: 'zone', id: 'z' }, shippingRates: [rate(currency, freeAbove)] }] },
    ]));
  }
  if (path === `/${PROJECT}/inventory`) {
    const where = url.searchParams.get('where') ?? '';
    const match = /^sku="([^"]+)"$/.exec(where);
    return json(res, 200, list(match ? inventoryEntries(match[1]) : []));
  }
  const cartMatch = new RegExp(`^/${PROJECT}/carts/([^/]+)$`).exec(path);
  if (cartMatch) {
    const cart = CARTS[cartMatch[1]];
    return cart ? json(res, 200, { id: cartMatch[1], version: 1, ...cart }) : json(res, 404, { statusCode: 404, message: 'not found' });
  }
  console.log(`mock-ct: no fixture for ${req.method} ${path}`);
  return json(res, 404, { statusCode: 404, message: 'No fixture', errors: [{ code: 'ResourceNotFound' }] });
}).listen(PORT, () => console.log(`mock-ct listening on https://localhost:${PORT} (project ${PROJECT})`));
