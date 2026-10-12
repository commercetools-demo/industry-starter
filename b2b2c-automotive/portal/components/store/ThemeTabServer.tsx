// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Server half of the Theme tab (workstream U-06): resolves what only the server knows (is Contentools connected, the project key,
// the storefront host) and hands booleans and plain strings to the client component. The JWT string never leaves the server.
import 'server-only';
import { ThemeTab } from '@/components/portal/ThemeTab';
import { getValidContentoolsJwt } from '@/lib/contentools/jwt';
import { getProjectKey } from '@/lib/contentools/project-key';
import { getPortalSession } from '@/lib/portal/viewer';
import { storefrontHost, storefrontOrigin, themeCacheSeconds } from '@/lib/portal/storefront-origin';

export async function ThemeTabServer({ locale }: { locale: string }) {
  const session = await getPortalSession();
  const connected = (await getValidContentoolsJwt()) !== null;
  return (
    <ThemeTab
      locale={locale}
      storeKey={session.storeKey ?? ''}
      connected={connected}
      projectKey={getProjectKey()}
      parentUrl={`/${locale}/store/theme`}
      host={storefrontHost(storefrontOrigin())}
      cacheSeconds={themeCacheSeconds()}
    />
  );
}
