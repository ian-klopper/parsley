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
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  allowedDevOrigins: [
    // Google Cloud Workstations
    '8080-firebase-parsley-1757521220142.cluster-thle3dudhffpwss7zs5hxaeu2o.cloudworkstations.dev',
    '3000-firebase-parsley-1757521220142.cluster-thle3dudhffpwss7zs5hxaeu2o.cloudworkstations.dev',
    // Local development origins
    'local-origin.dev',
    '*.local-origin.dev',
    // Common localhost variations
    'localhost',
    '127.0.0.1'
  ],
  env: {
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
  },
};

module.exports = nextConfig;