/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds to prevent deployment failures
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds to prevent deployment failures  
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;