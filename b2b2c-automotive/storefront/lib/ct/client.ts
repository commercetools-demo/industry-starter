// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { validateEnv, type CtConfig } from '@/lib/env';

/**
 * How the client authenticates. The default, `clientCredentials`, is the BFF's own token (scopes from CTP_SCOPES).
 * `anonymous` and `password` mint a token for one shopper; they are for the sign-in and cart endpoints (workstreams P, Q),
 * built per request and never cached across users, and their ids or passwords never reach the session cookie.
 */
export type AuthFlow =
  | { kind: 'clientCredentials' }
  | { kind: 'anonymous'; anonymousId: string }
  | { kind: 'password'; username: string; password: string };

/** The only place in the app that constructs a commercetools client (one ClientBuilder, lint-enforced). */
export function createApiRoot(c: CtConfig, flow: AuthFlow = { kind: 'clientCredentials' }): ByProjectKeyRequestBuilder {
  const base = { host: c.authUrl, projectKey: c.projectKey, scopes: c.scopes };
  const credentials = { clientId: c.clientId, clientSecret: c.clientSecret };
  const builder = new ClientBuilder().withProjectKey(c.projectKey);
  switch (flow.kind) {
    case 'clientCredentials':
      builder.withClientCredentialsFlow({ ...base, credentials });
      break;
    case 'anonymous':
      builder.withAnonymousSessionFlow({ ...base, credentials: { ...credentials, anonymousId: flow.anonymousId } });
      break;
    case 'password':
      builder.withPasswordFlow({ ...base, credentials: { ...credentials, user: { username: flow.username, password: flow.password } } });
      break;
  }
  const client = builder.withHttpMiddleware({ host: c.apiUrl }).build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: c.projectKey });
}

const config = validateEnv(process.env).frontend;
export const projectKey = config.projectKey;
/** Frontend (non-admin) client, one per server process. */
export const apiRoot = createApiRoot(config);
