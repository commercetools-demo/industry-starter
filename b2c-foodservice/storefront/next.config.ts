import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export const baseConfig: NextConfig = {
  images: {
    // Images are resized at render time by the image source, never by Next.
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withNextIntl(baseConfig);
