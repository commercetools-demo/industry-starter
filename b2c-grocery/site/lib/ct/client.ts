import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { validateEnv } from '../env';

let root: ByProjectKeyRequestBuilder | undefined;

/** One client per process, built lazily so `next build` never reads credentials at import time. */
export function getApiRoot(): ByProjectKeyRequestBuilder {
  if (!root) {
    const env = validateEnv();
    const client = new ClientBuilder()
      .withProjectKey(env.CTP_PROJECT_KEY)
      .withClientCredentialsFlow({
        host: env.CTP_AUTH_URL,
        projectKey: env.CTP_PROJECT_KEY,
        credentials: { clientId: env.CTP_CLIENT_ID, clientSecret: env.CTP_CLIENT_SECRET },
        scopes: env.CTP_SCOPES.split(' ').filter(Boolean),
      })
      .withHttpMiddleware({ host: env.CTP_API_URL })
      .build();
    root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.CTP_PROJECT_KEY });
  }
  return root;
}

export const getProjectKey = (): string => validateEnv().CTP_PROJECT_KEY;
export const getApiUrl = (): string => validateEnv().CTP_API_URL;
export const getAuthUrl = (): string => validateEnv().CTP_AUTH_URL;
