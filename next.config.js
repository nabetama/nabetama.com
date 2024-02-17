const { withContentlayer } = require('next-contentlayer')

/** @type {import('next').NextConfig;} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    scrollRestoration: true,
  },
  async rewrites() {
    return [
      {
        source: '/feed.xml',
        destination: '/api/feed.xml',
      },
    ]
  },
}

module.exports = withContentlayer(nextConfig)
