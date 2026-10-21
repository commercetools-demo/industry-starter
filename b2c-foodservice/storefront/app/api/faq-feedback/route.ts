import { FAQ_TOPICS, allFaqIds } from '@/content/faq';
import { handle, jsonError } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { isLocaleKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 2500;

/**
 * POST /api/faq-feedback { questionId, helpful, locale } -> 202 { recorded: true }.
 * Unknown question id: 400. With FEEDBACK_WEBHOOK_URL set the vote is forwarded (a 2xx is required, else 502);
 * without it one structured log line is the collector (Q-P-7). No personal data is sent or logged.
 */
export const POST = handle('/api/faq-feedback', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === 'object' ? raw : {}) as { questionId?: unknown; helpful?: unknown; locale?: unknown };
  if (typeof body.questionId !== 'string' || !allFaqIds(FAQ_TOPICS).includes(body.questionId) || typeof body.helpful !== 'boolean') {
    return jsonError('bad_request', 400);
  }
  const vote = {
    questionId: body.questionId,
    helpful: body.helpful,
    locale: isLocaleKey(body.locale) ? body.locale : 'en-US',
  };

  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (!url) {
    console.log(JSON.stringify({ route: 'faq-feedback', questionId: vote.questionId, helpful: vote.helpful }));
    return Response.json({ recorded: true }, { status: 202 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...vote, receivedAt: new Date().toISOString() }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AppError('upstream_unavailable', 502);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('upstream_unavailable', 502);
  } finally {
    clearTimeout(timer);
  }
  return Response.json({ recorded: true }, { status: 202 });
});
