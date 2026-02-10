/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow serving GIF from public/media for X card unfurl
  images: { unoptimized: true },
  // Handle native modules for image generation
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js", "sharp"],
  },
};

module.exports = nextConfig;
