import { timingSafeEqual } from 'node:crypto';
import { runAutoRefill } from '@/lib/ct/auto-refill-run';
import { log } from '@/lib/log';

/** Header the scheduled function sends. The value is `AUTO_REFILL_RUN_SECRET` (server-only, never in git). */
export const RUN_SECRET_HEADER = 'x-refill-secret';

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get(RUN_SECRET_HEADER) ?? '');
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * POST /api/internal/auto-refill-run: the work behind the Netlify scheduled function `auto-refill-run`.
 * It lives in the Next app because it uses the same modules as the storefront (prescription rules, ledger, recurring
 * orders). Never public: without `AUTO_REFILL_RUN_SECRET` configured it answers 503 (disabled), without the matching
 * header 401 with no detail. It answers counts only, never an id, a name or an RX number. Not cached.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.AUTO_REFILL_RUN_SECRET?.trim();
  const headers = { 'cache-control': 'no-store' };
  if (!secret || secret.length < 16) return Response.json({ error: 'Not available.' }, { status: 503, headers });
  if (!authorized(request, secret)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
  try {
    return Response.json(await runAutoRefill(), { headers });
  } catch (error) {
    log.error('auto-refill', 'run failed', error instanceof Error ? error : { name: typeof error });
    return Response.json({ error: 'The run failed.' }, { status: 500, headers });
  }
}
