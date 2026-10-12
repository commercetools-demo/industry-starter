// POST /api/auth/demo-login { customerId }: signs in a listed demo associate (R-17a). 404 when demo login is off.
import { z } from 'zod';
import { demoSignIn } from '@/lib/demo-login';
import { handle, parseJson } from '@/lib/portal/route-kit';

const body = z.object({ customerId: z.string().min(1, 'Choose a demo account.') });

export const POST = handle(async (request: Request) => {
  const { customerId } = await parseJson(request, body);
  return demoSignIn(customerId, request);
});
