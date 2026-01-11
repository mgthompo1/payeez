import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better debugging
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'recharts',
    ],
  },

  // Enable compression
  compress: true,

  // Power output for production
  poweredByHeader: false,

  // Strict mode for better error catching
  typescript: {
    // Don't fail build on TS errors in dev (faster iteration)
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
