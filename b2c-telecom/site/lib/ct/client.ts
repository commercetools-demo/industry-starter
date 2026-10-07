import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { validateEnv, type Env } from './env';

// The only module (besides scripts/seed/lib.ts) that builds a commercetools client. One ClientBuilder per process,
// created on first use so `next build` needs no credentials.
let apiRoot: ByProjectKeyRequestBuilder | undefined;
let env: Env | undefined;

function readEnv(): Env {
  env ??= validateEnv(process.env);
  return env;
}

export function getApiRoot(): ByProjectKeyRequestBuilder {
  if (apiRoot) return apiRoot;
  const { CTP_PROJECT_KEY: projectKey, CTP_AUTH_URL, CTP_API_URL, CTP_CLIENT_ID, CTP_CLIENT_SECRET, CTP_SCOPES } = readEnv();
  const client = new ClientBuilder()
    .withProjectKey(projectKey)
    .withClientCredentialsFlow({
      host: CTP_AUTH_URL,
      projectKey,
      credentials: { clientId: CTP_CLIENT_ID, clientSecret: CTP_CLIENT_SECRET },
      scopes: CTP_SCOPES.split(' ').filter(Boolean),
    })
    .withHttpMiddleware({ host: CTP_API_URL })
    .build();
  apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });
  return apiRoot;
}

export function getProjectKey(): string {
  return readEnv().CTP_PROJECT_KEY;
}

export function getApiUrl(): string {
  return readEnv().CTP_API_URL;
}

export function getAuthUrl(): string {
  return readEnv().CTP_AUTH_URL;
}
