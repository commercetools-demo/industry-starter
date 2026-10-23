import 'server-only';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * D-027: review creation uses a second, isolated, server-only API client. Writing a review needs `manage_products`
 * (there is no narrower scope), which the main storefront client must not carry. Only `lib/ct/reviews.ts` imports this.
 *
 * Names only (values live in git-ignored `.env.local`): `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, and
 * optionally `CTP_REVIEWS_SCOPES` (default `manage_products:<project key>`). Created on first use, so a missing
 * client only disables review writes; reading reviews and the rest of the site keep working.
 */
let root: ReturnType<typeof build> | undefined;

function build() {
  const env = getEnv();
  const clientId = process.env.CTP_REVIEWS_CLIENT_ID?.trim();
  const clientSecret = process.env.CTP_REVIEWS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new AppError('upstream_unavailable', 503);
  const scopes = (process.env.CTP_REVIEWS_SCOPES?.trim() || `manage_products:${env.CTP_PROJECT_KEY}`).split(/\s+/).filter(Boolean);
  const client = new ClientBuilder()
    .withProjectKey(env.CTP_PROJECT_KEY)
    .withClientCredentialsFlow({
      host: env.CTP_AUTH_URL,
      projectKey: env.CTP_PROJECT_KEY,
      credentials: { clientId, clientSecret },
      scopes,
    })
    .withHttpMiddleware({ host: env.CTP_API_URL, maskSensitiveHeaderData: true })
    .build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.CTP_PROJECT_KEY });
}

/** Review write root (create, update, delete). Throws `upstream_unavailable` when the second client is not configured. */
export function reviewWriteRoot() {
  root ??= build();
  return root;
}
