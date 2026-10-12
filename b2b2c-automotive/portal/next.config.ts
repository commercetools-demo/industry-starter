import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Dev-only pages are named page.dev.tsx and are registered outside production builds only (scripts/check-no-dev-pages.mjs).
  pageExtensions: process.env.NODE_ENV === 'production' ? ['tsx', 'ts'] : ['tsx', 'ts', 'dev.tsx', 'dev.ts'],
};

export default withNextIntl(nextConfig);
