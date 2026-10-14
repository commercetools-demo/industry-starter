// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { checkoutDevHosts } from './lib/checkout/env';
import { checkoutRegionFromEnv } from './lib/checkout/region';
import { buildCsp, extraImageHosts, portalOriginOf } from './lib/csp';
import { securityHeaders } from './lib/security/headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Photos come from any https host (seeded Image source, Contentools uploads); the CSP img-src (CSP_IMG_HOSTS) still decides what the browser loads.
const nextConfig: NextConfig = {
  // Workstream X (G03, E07): no framework banner, no source maps in the browser bundle.
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    const devHosts = checkoutDevHosts();
    const csp = buildCsp({
      dev: process.env.NODE_ENV === 'development',
      imgHosts: extraImageHosts(process.env.CSP_IMG_HOSTS),
      checkoutRegion: checkoutRegionFromEnv(process.env), // hosted Checkout hosts (workstream O), only with an Application key
      checkoutDevOrigin: devHosts ? new URL(devHosts.appUrl).origin : undefined, // local stand-in for a rehearsal, never in production
      // The portal live preview frames the storefront; only the portal origin may (development default http://localhost:3001).
      portalOrigin: portalOriginOf(process.env.PORTAL_ORIGIN) ?? (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3001'),
    });
    return [
      // No X-Frame-Options here: it cannot name the portal origin, so frame-ancestors in the CSP is the one framing rule.
      { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: csp }, ...securityHeaders({ geolocation: true, production: process.env.NODE_ENV === 'production' })] },
      // The confirmation page (workstream P) holds an order and its private link: no referrer leaks the link, no cache keeps the order.
      {
        source: '/:locale/:store/checkout/confirmation/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      // The reset link of the on-screen password reset (workstream Q-04) holds a token: no referrer, no cache.
      {
        source: '/:locale/:store/account/reset-password',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
