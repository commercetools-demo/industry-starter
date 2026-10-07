import { NextResponse } from 'next/server';
import { POSTAL_COOKIE, POSTAL_COOKIE_MAX_AGE } from '@/lib/config/eligibility';
import { errorResponse, json } from '@/lib/ct/http';
import { getServiceability } from '@/lib/ct/serviceability';
import { normalizePostalCode } from '@/lib/offers/serviceability';
import type { CountryCode } from '@/lib/types';

// "Is this ZIP served, and on which technology?" GET reads (and, without a postalCode, returns the remembered location);
// POST also remembers the ZIP in the HttpOnly cookie `malva-postal-code` (null clears it). The country comes from the
// request, never from the cookie.

const fail = (code: 'INVALID_POSTAL_CODE' | 'INVALID_COUNTRY' | 'INVALID_REQUEST', message: string) => json({ error: { code, message } }, { status: 400 });

function parseCountry(value: unknown): CountryCode | null {
  if (value === undefined || value === null || value === '') return 'US';
  return value === 'US' || value === 'DE' ? value : null;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const country = parseCountry(params.get('country'));
    if (!country) return fail('INVALID_COUNTRY', 'Country must be US or DE');
    const raw = params.get('postalCode');
    if (raw === null) {
      const remembered = cookieValue(request, POSTAL_COOKIE);
      const postalCode = remembered === undefined ? null : normalizePostalCode(remembered, country);
      return json({ location: postalCode === null ? null : await getServiceability().check(postalCode, country) });
    }
    const postalCode = normalizePostalCode(raw, country);
    if (postalCode === null) return fail('INVALID_POSTAL_CODE', 'Enter a valid ZIP code');
    return json({ location: await getServiceability().check(postalCode, country) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail('INVALID_REQUEST', 'Invalid JSON');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('INVALID_REQUEST', 'Expected a JSON object');
    const { postalCode: rawPostalCode, country: rawCountry } = body as Record<string, unknown>;
    const country = parseCountry(rawCountry);
    if (!country) return fail('INVALID_COUNTRY', 'Country must be US or DE');

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    };
    if (rawPostalCode === null) {
      const response: NextResponse = json({ location: null });
      response.cookies.set(POSTAL_COOKIE, '', { ...cookieOptions, maxAge: 0 });
      return response;
    }
    const postalCode = typeof rawPostalCode === 'string' ? normalizePostalCode(rawPostalCode, country) : null;
    if (postalCode === null) return fail('INVALID_POSTAL_CODE', 'Enter a valid ZIP code');
    const response: NextResponse = json({ location: await getServiceability().check(postalCode, country) });
    response.cookies.set(POSTAL_COOKIE, postalCode, { ...cookieOptions, maxAge: POSTAL_COOKIE_MAX_AGE });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
