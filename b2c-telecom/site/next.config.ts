import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { IMAGE_HOSTS } from './lib/config/images';
import { maybeValidateAtBuild } from './lib/ct/env-core';

// Netlify builds fail by variable name; local builds validate nothing (so `npm run verify` needs no credentials).
maybeValidateAtBuild(process.env);

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Files named *.dev.ts / *.dev.tsx (route.dev.ts, page.dev.tsx) are routes only in development: production builds do not contain them.
  pageExtensions: isProd ? ['tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts'],
  // Content pages read markdown from disk at request time (W): Netlify functions only see traced files.
  outputFileTracingIncludes: { '/**': ['./content/**/*', './scripts/seed/data/product-images.json'] },
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
