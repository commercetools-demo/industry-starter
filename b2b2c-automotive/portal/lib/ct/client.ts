// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { validateEnv, type CtConfig } from '@/lib/env';

/**
 * The only place in the app that constructs a commercetools client (one ClientBuilder, lint-enforced).
 * `admin-client.ts` and `provisioning-client.ts` call this with their own credentials; none of the three share a secret.
 */
export function createApiRoot(c: CtConfig): ByProjectKeyRequestBuilder {
  const client = new ClientBuilder()
    .withProjectKey(c.projectKey)
    .withClientCredentialsFlow({
      host: c.authUrl,
      projectKey: c.projectKey,
      credentials: { clientId: c.clientId, clientSecret: c.clientSecret },
      scopes: c.scopes,
    })
    .withHttpMiddleware({ host: c.apiUrl })
    .build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: c.projectKey });
}

const config = validateEnv(process.env).frontend;
export const projectKey = config.projectKey;
/** Frontend (non-admin) client, one per server process: login, as-associate buying, store and role reads. */
export const apiRoot = createApiRoot(config);
