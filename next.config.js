/** @type {import('next').NextConfig} */

const IS_PROD = process.env.NODE_ENV === 'production';

// CSP is now set dynamically in src/middleware.ts with per-request nonces.

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  serverExternalPackages: [
    '@vladmandic/face-api',
    'canvas',
  ],

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
    ],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }
    if (isServer) {
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];
      config.externals = [
        ...existing,
        '@vladmandic/face-api',
        'canvas',
      ];
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/models/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  async rewrites() {
    const passThrough = [
      { source: '/models/:path*', destination: '/models/:path*' },
    ];

    if (!IS_PROD) {
      return passThrough;
    }

    const backendUrl = (
      process.env.NEXT_PUBLIC_API_URL || ''
    ).trim().replace(/\/+$/, '');

    if (!backendUrl) {
      throw new Error(
        'NEXT_PUBLIC_API_URL is not set. Set it in Vercel project settings or .env.local'
      );
    }

    return [
      ...passThrough,
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
