import 'server-only';
import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { metricsMiddleware } from './metrics';
import { validateEnv, validateProvisioningEnv, type CtpConfig } from '../env';

/** The only place a commercetools client is built (malva-bff-and-session › Singleton). */
function buildRoot(config: CtpConfig): ByProjectKeyRequestBuilder {
  const builder = new ClientBuilder()
    .withProjectKey(config.projectKey)
    .withClientCredentialsFlow({
      host: config.authUrl,
      projectKey: config.projectKey,
      credentials: { clientId: config.clientId, clientSecret: config.clientSecret },
      scopes: config.scopes.split(/\s+/).filter(Boolean),
    })
    .withHttpMiddleware({ host: config.apiUrl, httpClient: fetch });
  const metrics = metricsMiddleware();
  const client = (metrics ? builder.withMiddleware(metrics) : builder).build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: config.projectKey });
}

/** Lazy: configuration is validated (and the client built) on first use, so `next build` needs no credentials. */
function lazyRoot(create: () => ByProjectKeyRequestBuilder): ByProjectKeyRequestBuilder {
  let root: ByProjectKeyRequestBuilder | undefined;
  const target = (): ByProjectKeyRequestBuilder => (root ??= create());
  return new Proxy({} as ByProjectKeyRequestBuilder, {
    get: (_unused, property) => {
      const value = Reflect.get(target(), property) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target()) : value;
    },
  });
}

/** The Frontend API client. Every storefront call goes through it. */
export const apiRoot: ByProjectKeyRequestBuilder = lazyRoot(() => buildRoot(validateEnv(process.env)));

/**
 * The narrow server-only client for registration: the My Business Units API creates a unit Inactive and cannot set its
 * status, stores or associates. Used only by workstreams F and N.
 */
export const provisioningRoot: ByProjectKeyRequestBuilder = lazyRoot(() => buildRoot(validateProvisioningEnv(process.env)));
