import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { mcFramingOrigin, securityHeaders } from './lib/security-headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export const baseConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers = securityHeaders({ dev: process.env.NODE_ENV !== 'production', reportOnly: process.env.CSP_REPORT_ONLY === 'true', frameAncestor: mcFramingOrigin(process.env) });
    return [{ source: '/:path*', headers }];
  },
  // forbidden() and unauthorized() need this flag in Next 16 (PROJECT-FINDINGS).
  experimental: { authInterrupts: true },
  // Every request gets blocking metadata: title, description and robots sit in <head> in the first bytes, not streamed
  // into <body> for browsers. Crawlers, link previews and audit tools read them without running scripts. The pages
  // already wait for their data, so the cost is nil (plans/evidence/Q/perf.md).
  htmlLimitedBots: /.*/,
  images: {
    // Images are resized at render time by the image source, never by Next.
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withNextIntl(baseConfig);
