import type { NextConfig } from 'next';
import { maybeValidateAtBuild } from './lib/ct/env-core';

// Netlify builds fail by variable name; local builds validate nothing (so `npm run verify` needs no credentials).
maybeValidateAtBuild(process.env);

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Files named *.dev.ts / *.dev.tsx (route.dev.ts, page.dev.tsx) are routes only in development: production builds do not contain them.
  pageExtensions: isProd ? ['tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts'],
  images: {
    unoptimized: true, // the commercetools image CDN rejects Next optimiser query parameters
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' }, // commercetools-hosted product images (Planner default)
    ],
  },
};
export default nextConfig;
