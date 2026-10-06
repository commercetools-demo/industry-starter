import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { shouldValidateAtBuild, validateEnv } from './lib/env-core';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// A Netlify build fails naming the missing variable instead of failing at runtime.
if (shouldValidateAtBuild()) validateEnv();

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default withNextIntl(nextConfig);
