import 'server-only';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { getEnv } from '@/lib/env';

const env = getEnv();

const client = new ClientBuilder()
  .withProjectKey(env.CTP_PROJECT_KEY)
  .withClientCredentialsFlow({
    host: env.CTP_AUTH_URL,
    projectKey: env.CTP_PROJECT_KEY,
    credentials: { clientId: env.CTP_CLIENT_ID, clientSecret: env.CTP_CLIENT_SECRET },
    scopes: env.CTP_SCOPES.split(/\s+/).filter(Boolean),
  })
  .withHttpMiddleware({ host: env.CTP_API_URL, maskSensitiveHeaderData: true })
  .build();

export const apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({
  projectKey: env.CTP_PROJECT_KEY,
});
export const projectKey = env.CTP_PROJECT_KEY;
