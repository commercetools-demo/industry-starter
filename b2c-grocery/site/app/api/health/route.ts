import { NextResponse } from 'next/server';
import { getApiRoot, getProjectKey } from '@/lib/ct/client';

// Development only; deleted in workstream Y.
export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await getApiRoot().get().execute();
    return NextResponse.json({ ok: true, projectKey: getProjectKey() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
