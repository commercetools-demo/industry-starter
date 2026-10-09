/** Security headers for every response (HSTS is set by the host). Image hosts match `images.remotePatterns` in next.config.ts. */
export const IMAGE_HOSTS = ['https://images.pexels.com', 'https://*.commercetools.com', 'https://storage.googleapis.com'];

export function contentSecurityPolicy(dev = process.env.NODE_ENV !== 'production'): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js hydrates with inline scripts; a nonce-based policy needs dynamic rendering, which would make public pages uncacheable (D20).
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:', 'wss:'] : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

export function securityHeaders(dev?: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ];
}
