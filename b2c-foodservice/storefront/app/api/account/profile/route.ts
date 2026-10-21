import { NextResponse } from 'next/server';
import { handle, requireCustomer } from '@/lib/api';
import { PHONE } from '@/lib/account/address-validate';
import { getProfile, updateProfile, type ProfileChange } from '@/lib/ct/customer';
import { AppError } from '@/lib/errors';
import { createSessionToken, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NAME_MAX = 60;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : undefined);

/** GET /api/account/profile -> 200 { profile: { firstName, lastName, email, phone, defaultShippingAddressId } }. */
export const GET = handle('/api/account/profile', async () => {
  const { customerId } = await requireCustomer();
  return Response.json({ profile: await getProfile(customerId) }, { headers: NO_STORE });
});

const fail = (fields: Record<string, string>) =>
  Response.json({ error: { code: 'validation_failed', message: 'Some of the information is not valid', fields } }, { status: 422 });

/**
 * PATCH /api/account/profile { firstName?, lastName?, phone?, defaultShippingAddressId? } -> 200 { profile }.
 * The email is read-only (Q-L-04): it is never read from the body. The phone is the default shipping address' phone (it
 * needs an address: 422 `phone: no_address` without one). The session cookie is refreshed so the greeting follows the name.
 */
export const PATCH = handle('/api/account/profile', async (req) => {
  const { customerId } = await requireCustomer();
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') throw new AppError('bad_request', 400);

  const change: ProfileChange = {};
  const fields: Record<string, string> = {};
  for (const key of ['firstName', 'lastName'] as const) {
    if (raw[key] === undefined) continue;
    const v = text(raw[key]);
    if (!v) fields[key] = 'required';
    else if (v.length > NAME_MAX) fields[key] = 'too_long';
    else change[key] = v;
  }
  if (raw.phone !== undefined) {
    const v = text(raw.phone);
    if (v === undefined || (v !== '' && !PHONE.test(v))) fields.phone = 'invalid';
    else change.phone = v;
  }
  if (raw.defaultShippingAddressId !== undefined) {
    if (typeof raw.defaultShippingAddressId === 'string' && ID.test(raw.defaultShippingAddressId)) change.defaultShippingAddressId = raw.defaultShippingAddressId;
    else fields.defaultShippingAddressId = 'invalid';
  }
  if (Object.keys(fields).length > 0) return fail(fields);

  let profile;
  try {
    profile = await updateProfile(customerId, change);
  } catch (e) {
    if (e instanceof AppError && e.code === 'validation_failed') return fail({ phone: 'no_address' });
    throw e;
  }
  const session = await getSession();
  const res = NextResponse.json({ profile }, { headers: NO_STORE });
  return setSessionCookie(res, await createSessionToken({ ...session, customerFirstName: profile.firstName, customerLastName: profile.lastName }));
});
