// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { z } from 'zod';
import { ApiError, handle } from '@/lib/api';
import { listVehicleRecords } from '@/lib/ct/vehicles';
import { buildCatalog } from '@/lib/vehicles/catalog';

const slug = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Invalid option');
const query = z
  .object({
    market: z.enum(['DE', 'US'], { error: 'Invalid market' }).optional(),
    make: slug.optional(),
    model: slug.optional(),
    year: z.string().regex(/^\d{4}$/, 'Invalid year').optional(),
  })
  .refine((q) => !q.model || q.make, 'model needs make')
  .refine((q) => !q.year || q.model, 'year needs model');

// Same for every shopper (the vehicle table is shared master data; `market` is part of the URL), so shared caches may keep it for 5 minutes.
// Netlify's CDN keys a cached response by path only; Netlify-Vary adds the query string (market, make, model, year) to the key.
const CACHE = { 'Cache-Control': 'public, max-age=300', 'Netlify-Vary': 'query' };
const unknown = () => new ApiError(404, 'unknown-option');

/**
 * Dependent selectors, derived from the year ranges of the vehicle table:
 * no parameter -> makes; `make` -> models; `make&model` -> years (descending, every year of every range);
 * `make&model&year` -> engines with the resulting `vehicleId`. `market` (DE or US) limits the table to that market.
 */
export const GET = handle(async (request: Request) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid request');
  const { market, make, model, year } = parsed.data;
  const catalog = buildCatalog(await listVehicleRecords(), market);

  if (!make) return Response.json({ level: 'make', options: catalog.makes() }, { headers: CACHE });
  if (!model) {
    const models = catalog.models(make);
    if (!models) throw unknown();
    return Response.json({ level: 'model', options: models }, { headers: CACHE });
  }
  if (!year) {
    const years = catalog.years(make, model);
    if (!years) throw unknown();
    return Response.json({ level: 'year', options: years.map((y) => ({ key: String(y), label: String(y) })) }, { headers: CACHE });
  }
  const engines = catalog.engines(make, model, Number(year));
  if (!engines) throw unknown();
  return Response.json({ level: 'engine', options: engines }, { headers: CACHE });
});
