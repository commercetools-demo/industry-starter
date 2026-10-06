import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { shouldValidateAtBuild, validateEnv } from './lib/env-core';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// A Netlify build fails naming the missing variable instead of failing at runtime.
if (shouldValidateAtBuild()) validateEnv();

const nextConfig: NextConfig = {
  // The markdown pages are read from disk at request time; make Netlify bundle them with the functions.
  outputFileTracingIncludes: { '/**': ['./content/**/*'] },
  // The hosted checkout and the confirmation page are per shopper (D-042, order-confirmation-page).
  async headers() {
    return [{ source: '/:locale/checkout/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default withNextIntl(nextConfig);
