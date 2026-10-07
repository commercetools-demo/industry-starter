import { NextResponse } from 'next/server';
import { evaluateFinancing } from '@/lib/ct/devices';
import { errorResponse, json } from '@/lib/ct/http';
import { getSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

/**
 * The financing decision for the session's bundle. Anonymous visitors are answered 200 with `outcome: 'sign-in-required'` when a
 * financed line is in the bundle (there is no 401 here). The rules are the stub in `lib/devices/financing.ts`.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const [session, market] = await Promise.all([getSession(), getMarket()]);
    return json({ decision: await evaluateFinancing(session, market) });
  } catch (error) {
    return errorResponse(error);
  }
}
