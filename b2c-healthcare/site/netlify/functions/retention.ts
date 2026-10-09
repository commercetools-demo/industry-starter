// A Netlify function runs outside Next, so (like the seed scripts) it builds its own commercetools client from the CTP_* environment.
/* eslint-disable @typescript-eslint/no-restricted-imports, no-restricted-syntax */
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { runRetention } from '../../scripts/privacy/retention';
import { handleRetention } from '../../scripts/privacy/retention-handler';
import type { Root } from '../../scripts/seed/lib';

/**
 * `POST /.netlify/functions/retention`: runs the retention rules (expired guest bookings, stale counters and
 * locks, old refill logs; see `scripts/privacy/retention.ts`) against the storefront's commercetools project. Guarded: the
 * caller must send `RETENTION_SECRET` in `x-malva-retention-secret`; without a configured secret it answers 503 and does nothing.
 * Idempotent. The schedule lives in `retention-scheduled.ts`, which calls this function with the secret. The storefront API
 * client needs `manage_custom_objects` for the project.
 */

function rootFromEnv(): Root {
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
  return handleRetention(request, {
    secret: process.env.RETENTION_SECRET,
    run: (now) => runRetention(rootFromEnv(), now, { log: () => undefined }),
  });
}
