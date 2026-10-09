import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { validateCtEnv } from '@/lib/env';

let instance: ByProjectKeyRequestBuilder | undefined;

/** The single commercetools client; built on first use (env validated then), reused afterwards. */
export function getApiRoot(): ByProjectKeyRequestBuilder {
  if (!instance) {
    const config = validateCtEnv();
    const client = new ClientBuilder()
      .withProjectKey(config.projectKey)
      .withClientCredentialsFlow({
        host: config.authUrl,
        projectKey: config.projectKey,
        credentials: { clientId: config.clientId, clientSecret: config.clientSecret },
        scopes: config.scopes,
      })
      .withHttpMiddleware({ host: config.apiUrl })
      .build();
    instance = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: config.projectKey });
  }
  return instance;
}

/** Lazy `apiRoot`: importing this module never reads the environment. */
export const apiRoot: ByProjectKeyRequestBuilder = new Proxy({} as ByProjectKeyRequestBuilder, {
  get(_target, prop) {
    const root = getApiRoot();
    const value = Reflect.get(root, prop, root) as unknown;
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(root) : value;
  },
});

/** Test hook: drop the cached client. */
export function resetApiRootForTests(): void {
  instance = undefined;
}
