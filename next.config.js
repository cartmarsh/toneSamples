/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable experimental features that might cause conflicts
  experimental: {
    serverActions: true,
    serverComponents: true,
    // Explicitly disable Turbopack
    turbo: false
  },
  // Add any other necessary configuration options
  webpack: (config, { isServer }) => {
    // Add any webpack-specific configurations here if needed
    return config
  }
}

module.exports = nextConfig 