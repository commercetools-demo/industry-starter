import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { guardAssistant } from '@/lib/agent/http/guard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/adopt-cart: RETIRED in workstream T2 (D-055). The assistant writes straight into the shopper's bag, so there is no
 * second cart to adopt. Answers 422 `assistant_cart_unusable` and writes nothing. The route is deleted with the Shopper MCP (U-11).
 */
export const POST = handle('/api/assistant/adopt-cart', async (req) => {
  const session = await getSession();
  const limited = guardAssistant(req, 'adopt', session.agentSessionId ?? '');
  if (limited) return limited;
  return domainError('assistant_cart_unusable', 422);
});
