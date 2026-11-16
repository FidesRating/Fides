import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // Old routes from the previous site map to the new ones with 301.
    const r = (source: string, destination: string) => ({ source, destination, statusCode: 301 as const });
    return [
      r('/qualified', '/under-review'),
      r('/log', '/actions'),
      r('/reports', '/research'),
      r('/reports/:slug*', '/research'),
      r('/ratingagents', '/'),
      r('/guide', '/'),
      r('/record', '/'),
      r('/corrections', '/'),
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
