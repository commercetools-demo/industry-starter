import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
