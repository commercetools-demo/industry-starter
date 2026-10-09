import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { securityHeaders } from './lib/security-headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const NO_STORE = [{ key: 'Cache-Control', value: 'no-store' }];

const nextConfig: NextConfig = {
  // Portal pages and every API response are per-visitor and never cached.
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders() },
      { source: '/api/:path*', headers: NO_STORE },
      { source: '/:locale/account/:path*', headers: NO_STORE },
    ];
  },
  // `/plumbing?sector=healthcare` keeps its public URL but is served by the static segment `/plumbing/sector/healthcare`
  // (workstream K), so a sector filter never makes a listing dynamic. Unknown sector values render the "no match" state.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/:locale/:category(plumbing|waste-management)',
          has: [{ type: 'query' as const, key: 'sector', value: '(?<sector>[A-Za-z0-9-]{1,40})' }],
          destination: '/:locale/:category/sector/:sector',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // The commercetools CDN rejects the optimizer's query parameters; photos are sized at source or via their own URL.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '*.commercetools.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
