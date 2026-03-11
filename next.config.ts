import type { NextConfig } from 'next';

const securityHeaders = [
  // Prevent the page from being embedded in an iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing the content type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control how much referrer info is sent with requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Enforce HTTPS for 1 year once deployed over TLS
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Disable browser features the app doesn't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy
  // - default-src 'self': block everything not explicitly allowed
  // - script-src 'self' 'unsafe-inline': Next.js injects inline bootstrap scripts
  // - style-src 'self' 'unsafe-inline': Tailwind and Next.js use inline styles
  // - connect-src 'self': fetch() calls are same-origin only
  // - img-src 'self' data:: allows data: URIs for any base64-embedded images
  // - font-src 'self': no external font CDNs
  // - frame-ancestors 'none': belt-and-suspenders with X-Frame-Options
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
