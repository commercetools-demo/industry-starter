// GET /api/seller/email/templates/[key]?storeKey= and PUT { storeKey, subject, body, enabled } (W-04). The body is strict; an
// unknown variable is 400 UNKNOWN_VARIABLE with `variable` naming the first offender. Nothing is sent, only stored.
import { getTemplate, saveTemplate } from '@/lib/ct/seller/email-templates';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { TemplateBody } from '@/lib/portal/w-schemas';

export const GET = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'email.manage');
  return json(await getTemplate(storeKey, await pathParam(context, 'key')));
});

export const PUT = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const body = await authorizedBody(request, TemplateBody, 'email.manage');
  return json(await saveTemplate(body.storeKey, await pathParam(context, 'key'), { subject: body.subject, body: body.body, enabled: body.enabled }));
});
