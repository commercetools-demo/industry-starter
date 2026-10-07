import { ApiError } from '@/lib/api-error';

/**
 * CSRF guard for every auth POST (together with SameSite=Lax): the `Origin` header host must equal the request host. A missing
 * `Origin` on a browser POST is refused. Ports are part of the host (localhost:3000 is not localhost:3001).
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) throw new ApiError('FORBIDDEN', 'Request origin not allowed');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError('FORBIDDEN', 'Request origin not allowed');
  }
  const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host'), new URL(request.url).host].filter((host): host is string => Boolean(host));
  if (!hosts.some((host) => host.toLowerCase() === originHost.toLowerCase())) throw new ApiError('FORBIDDEN', 'Request origin not allowed');
}
