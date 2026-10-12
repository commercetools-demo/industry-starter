// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { checkoutDevHosts } from './lib/checkout/env';
import { checkoutRegionFromEnv } from './lib/checkout/region';
import { buildCsp, extraImageHosts } from './lib/csp';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Image settings belong to the workstream that renders images.
const nextConfig: NextConfig = {
  async headers() {
    const devHosts = checkoutDevHosts();
    const csp = buildCsp({
      dev: process.env.NODE_ENV === 'development',
      imgHosts: extraImageHosts(process.env.CSP_IMG_HOSTS),
      checkoutRegion: checkoutRegionFromEnv(process.env), // hosted Checkout hosts (workstream O), only with an Application key
      checkoutDevOrigin: devHosts ? new URL(devHosts.appUrl).origin : undefined, // local stand-in for a rehearsal, never in production
    });
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: csp }] }];
  },
};

export default withNextIntl(nextConfig);
