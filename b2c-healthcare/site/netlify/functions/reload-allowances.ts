// A Netlify function runs outside Next, so (like the seed scripts) it builds its own commercetools client from the CTP_* environment.
/* eslint-disable @typescript-eslint/no-restricted-imports, no-restricted-syntax */
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { reloadAllowances } from '../../lib/funding/allowance-core';
import { customObjectsStore, type CustomObjectsRoot } from '../../lib/funding/ct-store';
import { handleReload } from '../../lib/funding/reload-handler';

/**
 * `POST /.netlify/functions/reload-allowances` (workstream U): runs the allowance reload against the storefront's
 * commercetools project. Guarded: the caller must send the shared secret in `x-malva-reload-secret`
 * (`RELOAD_ALLOWANCES_SECRET`); without a configured secret the function answers 503 and does nothing. The reload is
 * idempotent per member per cycle, so running it twice is harmless. The schedule lives in
 * `reload-allowances-scheduled.ts`, which calls this function with the secret.
 */

function rootFromEnv() {
  const env = process.env;
  const projectKey = env.CTP_PROJECT_KEY ?? '';
  const client = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: env.CTP_AUTH_URL ?? '',
      projectKey,
      credentials: { clientId: env.CTP_CLIENT_ID ?? '', clientSecret: env.CTP_CLIENT_SECRET ?? '' },
      ...(env.CTP_SCOPES ? { scopes: env.CTP_SCOPES.split(/[\s,]+/).filter(Boolean) } : {}),
    })
    .withHttpMiddleware({ host: env.CTP_API_URL ?? '' })
    .build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });
}

export default async function handler(request: Request): Promise<Response> {
  return handleReload(request, {
    secret: process.env.RELOAD_ALLOWANCES_SECRET,
    run: (now) => reloadAllowances(customObjectsStore(rootFromEnv() as unknown as CustomObjectsRoot), now),
  });
}
