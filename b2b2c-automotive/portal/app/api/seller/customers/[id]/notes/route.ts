// POST /api/seller/customers/[id]/notes { storeKey, text } : adds a note to a shopper of this store (V-05). Add and list only; the text
// has 1 to 1,000 characters and is stored and shown as text. Admin only.
import { z } from 'zod';
import { addCustomerNote, NOTE_MAX } from '@/lib/ct/seller/customers';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z.object({ storeKey: StoreKey, text: z.string().trim().min(1).max(NOTE_MAX) }).strict();

export const POST = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const body = await authorizedBody(request, Body, 'customers.manage');
  const id = await pathParam(context, 'id');
  const session = await authorizeSeller(body.storeKey, 'customers.manage');
  return json({ notes: await addCustomerNote(body.storeKey, id, body.text, session.customerId as string) }, { status: 201 });
});
