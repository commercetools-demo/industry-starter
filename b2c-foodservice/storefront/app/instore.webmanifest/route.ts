import { isInstore } from '@/lib/app-mode';
import { instoreManifest } from '@/lib/instore/manifest';

export const dynamic = 'force-dynamic';

/** `/instore.webmanifest` (workstream R): the install manifest of the In-store companion. The website has none: 404. */
export function GET(): Response {
  if (!isInstore()) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify(instoreManifest()), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
