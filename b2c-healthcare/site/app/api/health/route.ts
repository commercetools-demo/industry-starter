import { checkConnection } from '@/lib/ct/health';

// Development only: removed from release builds (scripts/check-no-health-in-release.mjs).
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  try {
    const { projectKey } = await checkConnection();
    return Response.json({ ok: true, projectKey });
  } catch {
    // No detail: errors can echo configuration.
    return Response.json({ ok: false }, { status: 500 });
  }
}
