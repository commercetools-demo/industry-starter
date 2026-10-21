import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { securityHeaders } from './lib/security-headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export const baseConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers = securityHeaders({ dev: process.env.NODE_ENV !== 'production', reportOnly: process.env.CSP_REPORT_ONLY === 'true' });
    return [{ source: '/:path*', headers }];
  },
  // forbidden() and unauthorized() need this flag in Next 16 (PROJECT-FINDINGS).
  experimental: { authInterrupts: true },
  images: {
    // Images are resized at render time by the image source, never by Next.
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withNextIntl(baseConfig);
