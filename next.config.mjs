// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
      // Cloudflare R2
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      // AWS S3
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "s3.amazonaws.com" },
      // Public CDN for previews / placeholders
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  experimental: {
    // Surface server-action stack traces in dev.
    typedRoutes: false,
  },
};

export default nextConfig;
