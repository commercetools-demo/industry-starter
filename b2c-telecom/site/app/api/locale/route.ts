import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { discardCartForSwitch, readCartForSwitch } from '@/lib/market/cartSeam';
import { planMarketSwitch } from '@/lib/market/switch';
import { isSupportedLocale, MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, marketFor } from '@/lib/utils';

function unsupported() {
  return NextResponse.json({ error: { code: 'VALIDATION', message: 'Unsupported locale' } }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unsupported();
  }
  const locale = typeof body === 'object' && body !== null ? (body as { locale?: unknown }).locale : undefined;
  if (!isSupportedLocale(locale)) return unsupported();

  const market = marketFor(locale);
  const plan = planMarketSwitch(market, await readCartForSwitch());
  const response = NextResponse.json({ locale: market.locale, currency: market.currency, country: market.country, cart: plan.cart });
  response.cookies.set(MARKET_COOKIE, market.locale, {
    path: '/',
    maxAge: MARKET_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  if (plan.cart.action === 'discarded') await discardCartForSwitch(response);
  revalidatePath('/', 'layout');
  return response;
}
