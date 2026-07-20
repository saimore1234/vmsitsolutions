import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required: Next.js App Router streams RSC payload/hydration data via
  // inline <script> tags on every page load, not just for a few opt-in cases.
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https: http:",
  "frame-src https://www.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "http", hostname: "**" }, { protocol: "https", hostname: "**" }] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Only wrap with Sentry's build-time plugin (source map upload etc.) when a DSN is actually
// configured — keeps local dev builds fast and avoids needing Sentry auth tokens to build at all.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true, org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, disableLogger: true })
  : nextConfig;
