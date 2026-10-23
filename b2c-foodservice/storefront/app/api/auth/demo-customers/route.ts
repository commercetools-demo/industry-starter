import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { demoLoginEnabled, listDemoCustomers } from '@/lib/auth/demo-customers';

export const dynamic = 'force-dynamic';

/** GET /api/auth/demo-customers -> 200 { customers: [{ key, name, market }] }; 404 when demo sign-in is off (D-040). */
export const GET = handle('/api/auth/demo-customers', async () => {
  if (!demoLoginEnabled()) return domainError('not_found', 404);
  return Response.json({ customers: listDemoCustomers() }, { headers: { 'Cache-Control': 'no-store' } });
});
