import { handle, jsonError } from '@/lib/api';
import { cardProductDetail, isProductId } from '@/lib/agent/http/card';
import { loadCallerSession } from '@/lib/agent/http/context';
import { guardAssistant } from '@/lib/agent/http/guard';
import { createStorefrontBackend } from '@/lib/ct/assistant-backend';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/assistant/card/product?id= -> 200 { product, variants } with the card serializer (same shape as a streamed card). 404 for an unknown id. */
export const GET = handle('/api/assistant/card/product', async (req) => {
  const session = await getSession();
  const limited = guardAssistant(req, 'card', session.agentSessionId ?? '');
  if (limited) return limited;
  const id = new URL(req.url).searchParams.get('id');
  if (!isProductId(id)) return jsonError('bad_request', 400);
  const caller = await loadCallerSession(session);
  if (!caller) return jsonError('not_found', 404);
  const backend = createStorefrontBackend(session, await getMarket());
  const detail = await cardProductDetail(backend, caller.context, id);
  return detail ? Response.json(detail) : jsonError('not_found', 404);
});
