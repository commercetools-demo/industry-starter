import { handle, ok } from '@/lib/api';
import { getRequestContext } from '@/lib/ct/quote-requests';
import { getSession } from '@/lib/session';

/** Prefill data for the request form: company, sites, contact and whether the role may submit. Anonymous visitors get an empty context (status 200). */
export const GET = handle(async () => ok(await getRequestContext(await getSession())));
