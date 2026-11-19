// next.config.mjs
/** Allow the configured storage hosts (public URL or S3 endpoint) for next/image. */
function storagePattern() {
  const urls = [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT, process.env.AWS_ENDPOINT_URL_S3];
  return urls.flatMap((raw) => {
    try {
      const url = new URL(raw || "");
      return [{ protocol: url.protocol.replace(":", ""), hostname: url.hostname }];
    } catch {
      return [];
    }
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      ...storagePattern(),
      // Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
      // Neon Storage (e.g. br-xxx.storage.c-1.ap-southeast-1.aws.neon.tech)
      { protocol: "https", hostname: "**.aws.neon.tech" },
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
