import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Static content (workstream V) is read from disk at runtime, so it must ship with the deployment.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  // Patient data is never cached (design-account-area: Caching). Route Handlers also set it themselves.
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store" }];
    return [
      { source: "/:locale/account/:path*", headers: noStore },
      { source: "/api/account/:path*", headers: noStore },
    ];
  },
  images: {
    // The commercetools CDN rejects the optimizer's query params.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
