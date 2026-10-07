/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: process.cwd(),
};
export default nextConfig;
