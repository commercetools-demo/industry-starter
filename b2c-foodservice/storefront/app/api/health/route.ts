import { NextResponse } from 'next/server';
import { apiRoot } from '@/lib/ct/client';
import { getEnv } from '@/lib/env';

// A GET handler is otherwise evaluated at build time; this must never call commercetools then.
export const dynamic = 'force-dynamic';

// Deleted before deploy (workstream Q); `npm run predeploy` fails while it exists.
export async function GET() {
  let key: string | undefined;
  try {
    const { body } = await apiRoot.get().execute();
    key = body.key;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'upstream_unavailable', message: 'commercetools did not answer' } },
      { status: 502 },
    );
  }

  const expected = getEnv().EXPECTED_PROJECT_KEY;
  if (key !== expected) {
    return NextResponse.json(
      { ok: false, error: { code: 'wrong_project', message: `API reports key "${key}", expected "${expected}"` } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, projectKey: key });
}
