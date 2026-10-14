// The commercetools client of workstream T: the seller-admin client, or in development with PORTAL_DEV_FIXTURES=on (never in
// production) the in-memory fixture client so the screens run without credentials. Always loaded lazily, so a build without
// the fixture flag never validates or needs anything extra.
import 'server-only';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { devFixturesEnabled } from '@/lib/portal/seam';

export async function catalogRoot(): Promise<ByProjectKeyRequestBuilder> {
  if (devFixturesEnabled()) return (await import('@/lib/portal/catalog-fixture-root')).fixtureRoot as unknown as ByProjectKeyRequestBuilder;
  return (await import('@/lib/ct/admin-client')).adminRoot;
}
