import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { buildCsp, originOf } from './lib/csp';
import { securityHeaders } from './lib/security/headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Dev-only pages are named page.dev.tsx and are registered outside production builds only (scripts/check-no-dev-pages.mjs).
  pageExtensions: process.env.NODE_ENV === 'production' ? ['tsx', 'ts'] : ['tsx', 'ts', 'dev.tsx', 'dev.ts'],
  // Workstream X (G03, E07): no framework banner, no source maps in the browser bundle.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    const csp = buildCsp({
      dev: process.env.NODE_ENV === 'development',
      storefrontOrigin: originOf(process.env.STOREFRONT_ORIGIN) ?? (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000'),
    });
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          ...securityHeaders({ frameOptions: 'DENY', production: process.env.NODE_ENV === 'production' }),
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
