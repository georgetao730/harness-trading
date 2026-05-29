import type { NextConfig } from 'next';

const API_TARGET = process.env.BACKEND_URL || 'http://localhost:18766';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
