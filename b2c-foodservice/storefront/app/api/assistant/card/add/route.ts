import { handle, jsonError } from '@/lib/api';
import { cardAdd, isProductId } from '@/lib/agent/http/card';
import { loadCallerSession } from '@/lib/agent/http/context';
import { guardAssistant } from '@/lib/agent/http/guard';
import { assistantConfig } from '@/lib/agent/service';
import { createStorefrontBackend } from '@/lib/ct/assistant-backend';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/card/add { id, quantity } -> 200 { cart } (the assistant's cart as the card shows it).
 * A shopper action from a card: caps and the options hold apply, provenance does not. 409 `conflict` carries the reason text for a held add.
 */
export const POST = handle('/api/assistant/card/add', async (req) => {
  const session = await getSession();
  const limited = guardAssistant(req, 'card', session.agentSessionId ?? '');
  if (limited) return limited;
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (!isProductId(b.id)) return jsonError('bad_request', 400);
  const quantity = typeof b.quantity === 'number' ? b.quantity : 1;

  const caller = await loadCallerSession(session);
  if (!caller) return jsonError('not_found', 404);
  const backend = createStorefrontBackend(session, await getMarket());
  const result = await cardAdd({
    backend,
    config: assistantConfig(),
    session: caller.context,
    productId: b.id,
    quantity,
  });
  if (!result.ok) return Response.json({ error: { code: 'conflict', message: result.reason } }, { status: 409 });
  return Response.json({ cart: result.cart });
});
