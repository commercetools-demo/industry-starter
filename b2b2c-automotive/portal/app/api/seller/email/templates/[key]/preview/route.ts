// POST /api/seller/email/templates/[key]/preview { storeKey, subject, body } : renders unsaved text with the sample order
// (MO-482913, Alex Muster), escaped, and returns the store's brand (logo, primary colour). Stores nothing, sends nothing.
import { previewTemplate } from '@/lib/ct/seller/email-templates';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { PreviewBody } from '@/lib/portal/w-schemas';
import { isTemplateKey } from '@/lib/email/defaults';
import { ApiError } from '@/lib/portal/route-kit';
import { getBrand } from '@/lib/theme/brand';

export const POST = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const body = await authorizedBody(request, PreviewBody, 'email.manage');
  if (!isTemplateKey(await pathParam(context, 'key'))) throw new ApiError(404, 'Not found');
  return json({ ...previewTemplate({ subject: body.subject, body: body.body }), brand: await getBrand(body.storeKey) });
});
