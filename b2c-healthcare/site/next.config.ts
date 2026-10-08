import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Static content (workstream V) is read from disk at runtime, so it must ship with the deployment.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
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
