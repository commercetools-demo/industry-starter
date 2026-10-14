// POST /api/seller/store/geocode { storeKey, address } (workstream U-05, Q-U07): "Find coordinates" through OpenStreetMap
// Nominatim on the server (1 request per second, cached 24 h). Never an error for an unreachable geocoder: the form keeps the
// manual latitude and longitude fields.
import { geocodeAddress } from '@/lib/geo/nominatim';
import { json } from '@/lib/portal/route-kit';
import { authorizeBody, storeHandle } from '@/lib/portal/store-route';
import { geocodeInput } from '@/lib/store/schemas';

export const POST = storeHandle(async (request: Request) => {
  const { body } = await authorizeBody(request, 'store.edit', geocodeInput);
  const outcome = await geocodeAddress(body.address);
  return json({ result: outcome.result, unavailable: outcome.unavailable });
});
