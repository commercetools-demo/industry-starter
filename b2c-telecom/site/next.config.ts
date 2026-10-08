import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { IMAGE_HOSTS } from './lib/config/images';
import { maybeValidateAtBuild } from './lib/ct/env-core';
import securityHeaders from './config/security-headers.json';

// Netlify builds fail by variable name; local builds validate nothing (so `npm run verify` needs no credentials).
maybeValidateAtBuild(process.env);

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Files named *.dev.ts / *.dev.tsx (route.dev.ts, page.dev.tsx) are routes only in development: production builds do not contain them.
  pageExtensions: isProd ? ['tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts'],
  // Content pages read markdown from disk at request time (W): Netlify functions only see traced files.
  outputFileTracingIncludes: { '/**': ['./content/**/*', './scripts/seed/data/product-images.json'] },
  // The auth pages carry per-visitor state (and the reset token in the URL): never cached by a browser or proxy (R).
  async headers() {
    return [
      { source: '/:locale/(login|register|forgot-password|reset-password)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      // The account pages (S, T, V) show one customer's orders and data: never cached by a browser or a shared proxy.
      { source: '/:locale/account/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      // The checkout and the confirmation page show one buyer's cart and order (U): never cached.
      { source: '/:locale/bundle/checkout', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/:locale/order-confirmation/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      // Security headers on every page (Y). The same five are repeated in ../netlify.toml for static assets.
      { source: '/:path*', headers: securityHeaders },
    ];
  },
  images: {
    unoptimized: true, // the commercetools image CDN rejects Next optimiser query parameters
    remotePatterns: [
      ...IMAGE_HOSTS.map((hostname) => ({ protocol: 'https' as const, hostname })), // seeded stock photos (D-055, D-066)
      { protocol: 'https', hostname: 'storage.googleapis.com' }, // commercetools-hosted product images (Planner default)
    ],
  },
};
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
