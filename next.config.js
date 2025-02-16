/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add any necessary configuration options
  webpack: (config, { isServer }) => {
    // Add any webpack-specific configurations here if needed
    return config
  }
}

module.exports = nextConfig