// POST /api/auth/register: reseller registration (R-07). The account stays pending: the real PortalPorts.register creates the
// customer, then an inactive Company business unit with the provisioning client (compensating delete of the customer on
// failure); a Malva operator activates it in the Merchant Center (OA-11). No session is started here.
// Trade-off: a duplicate email answers 400 with a generic text, which reveals some existence information; this is inherent to registration.
import { z } from 'zod';
import { ApiError, handle, json, parseJson } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';

const CREATED_MESSAGE = 'Account created. Awaiting Malva approval of your business.';
const FAILED_MESSAGE = "We couldn't create that account. Try signing in.";

const body = z.object({
  companyName: z.string().trim().min(2, 'Enter a company name of 2 to 80 characters.').max(80, 'Enter a company name of 2 to 80 characters.'),
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(12, 'The password must have at least 12 characters.'),
});

/** Idempotency by lower-cased email: a concurrent second call for the same email creates nothing. */
const inFlight = new Set<string>();

export const POST = handle(async (request: Request) => {
  const input = await parseJson(request, body);
  const email = input.email.toLowerCase();
  if (inFlight.has(email)) throw new ApiError(400, FAILED_MESSAGE, 'REGISTER_FAILED');
  inFlight.add(email);
  try {
    const result = await getPorts().register({ ...input, email });
    if (result === 'duplicate') throw new ApiError(400, FAILED_MESSAGE, 'REGISTER_FAILED');
    return json({ status: 'created', message: CREATED_MESSAGE });
  } finally {
    inFlight.delete(email);
  }
});
