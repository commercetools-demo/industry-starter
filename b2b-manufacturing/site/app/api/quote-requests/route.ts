import { handle, ok, parseBody, requireBusinessUnit } from '@/lib/api';
import { clientKey, enforce } from '@/lib/auth-limits';
import { listQuoteRequests } from '@/lib/ct/quote-requests';
import { servicesFor } from '@/lib/quote/list-api';
import { submitRequestSchema } from '@/lib/quote/schemas';
import { sessionFor } from '@/lib/quote/session';
import { QuoteSubmitError, submitQuoteRequest } from '@/lib/quote/submit';
import { saveSession } from '@/lib/session';

/**
 * Submit a request (one idempotent action). Body: `{ idempotencyKey, locale?, fields, website? }` where `website` is the honeypot.
 * Answers `{ reference }`; refusals carry `{ error, code, fieldErrors? }`.
 */
export const POST = handle(async (request: Request) => {
  await enforce('quoteRequest', clientKey(request));
  const body = await parseBody(request, submitRequestSchema);
  try {
    const session = await sessionFor(body.locale);
    const { reference, session: next } = await submitQuoteRequest(session, body, await servicesFor(session.locale));
    await saveSession(next);
    return ok({ reference });
  } catch (error) {
    if (error instanceof QuoteSubmitError) return Response.json({ error: error.message, code: error.code, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) }, { status: error.status });
    throw error;
  }
});

/** The signed-in client's Quote Requests, newest first (the portal screen of workstream R builds on the same helper). */
export const GET = handle(async () => {
  const session = await requireBusinessUnit();
  return ok({ requests: await listQuoteRequests(session) });
});
