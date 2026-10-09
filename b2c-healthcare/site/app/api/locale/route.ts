import { ApiError, handle } from '@/lib/api';
import { getValidCountryConfig } from '@/lib/ct/locale-validation';
import { getSession, setLocale } from '@/lib/session';

/**
 * POST /api/locale { locale } switches region. locale, country and currency are one unit:
 * a body with currency or country but no locale is rejected; extra fields must agree with the table.
 * The session is written from COUNTRY_CONFIG only, and cartId is cleared when the currency changes. The answer says so
 * (`cartCleared`): a cart's currency is fixed at creation, so it cannot be re-priced; the UI tells the patient and the
 * old cart is left to expire (the cart module ignores a cart in another currency).
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body: unknown = await request.json().catch(() => null);
    const input = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const { locale, country, currency } = input;
    if (typeof locale !== 'string' || locale.length === 0) {
      throw new ApiError(400, 'locale is required; locale, country and currency change together.');
    }
    const valid = await getValidCountryConfig();
    const config = (valid as Record<string, { country: string; currency: string } | undefined>)[locale];
    if (!config) throw new ApiError(400, 'This region is not supported.');
    if ((country !== undefined && country !== config.country) || (currency !== undefined && currency !== config.currency)) {
      throw new ApiError(400, 'country and currency must match the locale.');
    }
    const before = await getSession();
    const session = await setLocale({ locale });
    return { locale: session.locale, country: session.country, currency: session.currency, cartCleared: Boolean(before.cartId) && !session.cartId };
  });
}
