/** @type {import('next').NextConfig} */

// This dashboard loads no third-party scripts and makes no client-side network
// calls other than to its own /api/jotform route. The only external resource is
// the Google Fonts stylesheet (+ the font files it references) used by the
// existing black/gold/cream design — everything else is same-origin.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // 'unsafe-inline' is required here because React applies inline `style` attributes
  // (used throughout the existing dashboard components) and recharts renders SVG
  // elements with inline styles — this does not affect script-src, which stays strict.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Clickjacking protection — blocks this app from being framed by any origin.
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
  // Legacy clickjacking header for browsers that don't honor frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Vercel serves this app over HTTPS; instruct browsers to always use it.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  // Removes the `X-Powered-By: Next.js` response header (minor info-disclosure hardening).
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Applies to every route, including /api/jotform.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;

