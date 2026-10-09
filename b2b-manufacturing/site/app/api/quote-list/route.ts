import { handle } from '@/lib/api';
import { getQuoteList } from '@/lib/ct/quote-list';
import { addLineHandler, withList } from '@/lib/quote/list-api';

/** The visitor's quote list (anonymous allowed). An empty list is `{ id: null, lines: [], count: 0 }`, never an error. */
export const GET = handle(async (request: Request) => withList(request, (session, services) => getQuoteList(session, services), { readOnly: true }));

/** Same as POST /api/quote-list/lines. */
export const POST = addLineHandler;
