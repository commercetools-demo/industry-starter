import { getApiRoot, getApiUrl } from '@/lib/ct/client';
import { getRegion } from '@/lib/ct/env';
import { json } from '@/lib/ct/http';

// Development-only connection check (absent from production builds: see pageExtensions in next.config.ts).
export async function GET() {
  try {
    const { body } = await getApiRoot().get().execute();
    return json({ ok: true, projectKey: body.key, region: getRegion(getApiUrl()) });
  } catch (err) {
    // Only the error name: no message, no upstream body, no credentials.
    return json({ ok: false, error: err instanceof Error ? err.name : 'Error' }, { status: 500 });
  }
}
