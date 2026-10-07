import { getBundlePrompts } from '@/lib/ct/bundle';
import { errorResponse, json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

/** The offers that would activate a discount the buyer can really get, each with its monthly saving. Never cached (D-027). */
export async function GET() {
  try {
    const [session, market] = await Promise.all([getSession(), getMarket()]);
    return json({ prompts: await getBundlePrompts(session, market) });
  } catch (error) {
    return errorResponse(error);
  }
}
