import { NextResponse } from 'next/server';
import { apiRoot } from '@/lib/ct/client';

/** Development-only connection check. Absent from release builds (scripts/check-no-health-in-release.mjs). */
export async function GET() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  try {
    const project = await apiRoot.get().execute();
    // An empty listing would hide a missing index, so say so explicitly.
    const status = project.body.searchIndexing?.products?.status;
    return NextResponse.json({ ok: true, projectKey: project.body.key, search: status === 'Activated' ? 'ok' : 'indexing-missing' });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
