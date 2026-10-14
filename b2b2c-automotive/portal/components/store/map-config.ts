// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// OpenStreetMap tiles (no key). The attribution is required by the tile usage policy and must stay visible; the CSP in
// next.config.ts allows exactly this tile host for images (lib/csp.ts).
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
export const OSM_ATTRIBUTION = `&copy; <a href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors`;
export const MAP_MAX_ZOOM = 19;
