/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip ESLint during production builds (not needed for API-only backend)
  eslint: { ignoreDuringBuilds: true },
  // Allow serving GIF from public/media for X card unfurl
  images: { unoptimized: true },
  // Handle native modules for image generation
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "sharp"],
  },
};

module.exports = nextConfig;
