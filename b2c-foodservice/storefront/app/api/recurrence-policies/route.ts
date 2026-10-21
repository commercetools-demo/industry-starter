import { handle, jsonError } from '@/lib/api';
import { getRecurrencePolicies } from '@/lib/ct/product-detail';
import { isLocaleKey } from '@/lib/utils';

/**
 * GET /api/recurrence-policies?locale=en-US
 * 200 { policies: RecurrencePolicyView[] } (`{ id, key, name, schedule: { unit, value } }`). Public, stable data with no
 * session or cookie in the answer, so it is cacheable: `Cache-Control: public, max-age=300`. The locale only picks the
 * policy name; an unknown locale is `bad_request`. Exported for I, K and N (change interval on a bag line or a subscription).
 */
export const GET = handle('/api/recurrence-policies', async (req) => {
  const param = new URL(req.url).searchParams.get('locale');
  const locale = param ?? 'en-US';
  if (!isLocaleKey(locale)) return jsonError('bad_request', 400);
  const policies = await getRecurrencePolicies(locale);
  return Response.json({ policies }, { headers: { 'Cache-Control': 'public, max-age=300' } });
});
