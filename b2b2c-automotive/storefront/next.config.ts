// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { buildCsp, extraImageHosts } from './lib/csp';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Image settings belong to the workstream that renders images.
const nextConfig: NextConfig = {
  async headers() {
    const csp = buildCsp({ dev: process.env.NODE_ENV === 'development', imgHosts: extraImageHosts(process.env.CSP_IMG_HOSTS) });
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: csp }] }];
  },
};

export default withNextIntl(nextConfig);
