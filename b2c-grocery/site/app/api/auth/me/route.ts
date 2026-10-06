import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/** Session only: no commercetools call. `{ user: null }` for anonymous visitors. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const res = NextResponse.json({
    user: session.customerId
      ? {
          id: session.customerId,
          email: session.customerEmail ?? '',
          firstName: session.customerFirstName ?? '',
          lastName: session.customerLastName ?? '',
        }
      : null,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
