import 'server-only';
import type { Middleware } from '@commercetools/ts-client';

export const metricsEnabled = (env: Record<string, string | undefined> = process.env): boolean => env.NODE_ENV !== 'production' && env.CT_METRICS === '1';

/** Development aid (W-04): with `CT_METRICS=1` every commercetools call is logged as `[ct] METHOD path`, so calls per page render can be counted. Never active in production. */
export function metricsMiddleware(log: (line: string) => void = console.log): Middleware | undefined {
  if (!metricsEnabled()) return undefined;
  return (next) => async (request) => {
    const started = Date.now();
    const response = await next(request);
    // A short fingerprint of the request body tells repeated lookups from different ones; no values are logged beyond 60 characters of search terms.
    const what = request.body ? ` ${JSON.stringify(request.body).replace(/"productProjectionParameters".*$/, '').slice(0, 90)}` : '';
    log(`[ct] ${request.method ?? 'GET'} ${String(request.uri ?? '').replace(/\?.*$/, '')} ${Date.now() - started}ms${what}`);
    return response;
  };
}
