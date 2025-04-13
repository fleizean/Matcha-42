/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: '127.0.0.1',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '8000',
        pathname: '/media/**',
      },
    ]
  },
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: process.env.NEXT_PUBLIC_BACKEND_API_URL + '/media/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // For WebSocket connections to work properly
    if (!isServer) {
      config.externals = [...(config.externals || []), "ws"];
    }
    return config;
  },
}

module.exports = nextConfig